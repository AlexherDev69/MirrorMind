use base64::Engine;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

use super::process_utils::hidden_command;
use super::settings::AudioMode;

const SCRCPY_SERVER_PATH: &str = "/data/local/tmp/scrcpy-server.jar";
const SCRCPY_VERSION: &str = "3.1";
const LOCAL_PORT: u16 = 27183;
const MAX_CONNECT_RETRIES: u32 = 20;
const CONNECT_RETRY_DELAY_MS: u64 = 500;
/// Minimum API level for `audio_source=playback`, the only source scrcpy can
/// duplicate back to the phone speaker (Android 13).
const ANDROID_13_SDK: u32 = 33;

// scrcpy control message types
const CONTROL_MSG_INJECT_KEYCODE: u8 = 0;
const CONTROL_MSG_INJECT_TEXT: u8 = 1;
const CONTROL_MSG_INJECT_TOUCH: u8 = 2;
const CONTROL_MSG_INJECT_SCROLL: u8 = 3;
const CONTROL_MSG_BACK_OR_SCREEN_ON: u8 = 4;
const CONTROL_MSG_GET_CLIPBOARD: u8 = 8;
const CONTROL_MSG_SET_CLIPBOARD: u8 = 9;

// Android KeyEvent actions
pub(crate) const AKEY_EVENT_ACTION_DOWN: u8 = 0;
pub(crate) const AKEY_EVENT_ACTION_UP: u8 = 1;

// Android MotionEvent actions
const AMOTION_EVENT_ACTION_DOWN: u8 = 0;
const AMOTION_EVENT_ACTION_UP: u8 = 1;

const MAX_VIDEO_PACKET_BYTES: usize = 10_000_000;
const MAX_AUDIO_PACKET_BYTES: usize = 1_000_000;
const MAX_CLIPBOARD_BYTES: usize = 1_000_000;
const CLIPBOARD_RESPONSE_TIMEOUT: Duration = Duration::from_secs(2);
const DEVICE_MSG_TYPE_CLIPBOARD: u8 = 0;
/// FourCC scrcpy sends on the audio socket when Opus capture started.
const AUDIO_CODEC_OPUS: [u8; 4] = *b"opus";

pub struct StreamState {
    /// Stop flag of the running session. Each session gets its own flag so the
    /// reader threads of a superseded session can never be revived.
    stop_flag: Mutex<Arc<AtomicBool>>,
    pub control_socket: Arc<Mutex<Option<TcpStream>>>,
    pub audio_socket: Arc<Mutex<Option<TcpStream>>>,
    pub screen_width: Arc<Mutex<u32>>,
    pub screen_height: Arc<Mutex<u32>>,
    pub recording_file: Arc<Mutex<Option<(std::fs::File, String)>>>,
}

#[tauri::command]
pub async fn push_scrcpy_server(app: AppHandle, serial: String) -> Result<(), String> {
    super::adb::validate_serial(&serial)?;
    let server_path = get_server_jar_path(&app)?;

    let output = hidden_command("adb")
        .args(["-s", &serial, "push", &server_path, SCRCPY_SERVER_PATH])
        .output()
        .map_err(|e| format!("Failed to push scrcpy-server: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to push scrcpy-server: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

fn get_server_jar_path(app: &AppHandle) -> Result<String, String> {
    // Bundled release: resolve from the Tauri resource directory.
    if let Ok(resource_path) = app
        .path()
        .resolve("assets/scrcpy-server.jar", tauri::path::BaseDirectory::Resource)
    {
        if resource_path.exists() {
            return Ok(resource_path.to_string_lossy().to_string());
        }
    }

    // Dev fallback: relative to the working directory.
    let dev_paths = [
        "public/assets/scrcpy-server.jar",
        "../public/assets/scrcpy-server.jar",
    ];
    for path in dev_paths {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }

    Err("scrcpy-server.jar not found".to_string())
}

impl StreamState {
    /// Stop flag of the session currently running.
    pub fn stop_flag(&self) -> Arc<AtomicBool> {
        self.stop_flag.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// Stop the running session: raise its flag and close the sockets still
    /// held here, which also makes the scrcpy server on the phone exit.
    fn stop_session(&self) {
        self.stop_flag().store(true, Ordering::Relaxed);
        for socket in [&self.control_socket, &self.audio_socket] {
            if let Some(stream) = socket.lock().unwrap_or_else(|e| e.into_inner()).take() {
                let _ = stream.shutdown(std::net::Shutdown::Both);
            }
        }
    }

    /// Install a fresh stop flag for a new session and return it.
    fn begin_session(&self) -> Arc<AtomicBool> {
        let fresh = Arc::new(AtomicBool::new(false));
        *self.stop_flag.lock().unwrap_or_else(|e| e.into_inner()) = fresh.clone();
        fresh
    }
}

/// Result of a read that also watches the session stop flag.
enum ReadOutcome {
    Filled,
    Stopped,
}

/// Fill `buf` completely, resuming after read timeouts. `read_exact` drops
/// the bytes it already consumed when it times out, which would desynchronise
/// the packet stream.
fn read_full(
    stream: &mut TcpStream,
    buf: &mut [u8],
    stop_flag: &AtomicBool,
) -> std::io::Result<ReadOutcome> {
    use std::io::ErrorKind;

    let mut filled = 0;
    while filled < buf.len() {
        if stop_flag.load(Ordering::Relaxed) {
            return Ok(ReadOutcome::Stopped);
        }
        match stream.read(&mut buf[filled..]) {
            Ok(0) => return Err(ErrorKind::UnexpectedEof.into()),
            Ok(read) => filled += read,
            Err(ref e)
                if matches!(
                    e.kind(),
                    ErrorKind::TimedOut | ErrorKind::WouldBlock | ErrorKind::Interrupted
                ) => {}
            Err(e) => return Err(e),
        }
    }
    Ok(ReadOutcome::Filled)
}

/// Emit `event` unless the session was stopped or superseded, so a dying
/// session cannot disturb the one that replaced it.
fn emit_if_running(app: &AppHandle, stop_flag: &AtomicBool, event: &str, payload: &str) {
    if !stop_flag.load(Ordering::Relaxed) {
        let _ = app.emit(event, payload);
    }
}

/// scrcpy-server audio parameters for the selected mode.
struct AudioSetup {
    /// Parameters appended to the scrcpy-server command line.
    args: String,
    /// `None` when audio is streamed to the PC. Otherwise the reason sent to
    /// the UI, and a signal that the server opens no audio socket at all.
    disabled_reason: Option<&'static str>,
}

/// Read the device API level (`ro.build.version.sdk`).
fn get_device_sdk(serial: &str) -> Option<u32> {
    let output = hidden_command("adb")
        .args(["-s", serial, "shell", "getprop", "ro.build.version.sdk"])
        .output()
        .ok()?;
    String::from_utf8_lossy(&output.stdout).trim().parse().ok()
}

/// Build the audio parameters for `mode`.
///
/// `audio_source=output` routes the phone output through REMOTE_SUBMIX, which
/// silences the phone speaker while capturing. Keeping the sound on the phone
/// therefore means either capturing with `playback` + `audio_dup`
/// (Android 13+) or not capturing at all.
fn build_audio_setup(mode: AudioMode, device_sdk: Option<u32>) -> AudioSetup {
    const COMMON: &str = "audio=true audio_codec=opus audio_bit_rate=128000 audio_buffer=5";

    match mode {
        AudioMode::PhoneOnly => AudioSetup {
            args: "audio=false".to_string(),
            disabled_reason: Some("phone-only"),
        },
        AudioMode::PcOnly => AudioSetup {
            args: format!("{} audio_source=output", COMMON),
            disabled_reason: None,
        },
        AudioMode::Both => {
            if device_sdk.unwrap_or(0) >= ANDROID_13_SDK {
                AudioSetup {
                    args: format!("{} audio_source=playback audio_dup=true", COMMON),
                    disabled_reason: None,
                }
            } else {
                // Falling back to `output` would mute the phone, the opposite
                // of what this mode promises, so skip capture instead.
                AudioSetup {
                    args: "audio=false".to_string(),
                    disabled_reason: Some("requires-android-13"),
                }
            }
        }
    }
}

#[tauri::command]
pub async fn start_stream(app: AppHandle, serial: String) -> Result<(), String> {
    super::adb::validate_serial(&serial)?;

    // 0. Stop a session that is still running (e.g. USB to WiFi switch), so
    // its server releases the socket name before the new one starts.
    if let Some(state) = app.try_state::<StreamState>() {
        state.stop_session();
    }

    // 1. Remove any previous port forwarding
    let _ = hidden_command("adb")
        .args(["-s", &serial, "forward", "--remove", &format!("tcp:{}", LOCAL_PORT)])
        .output();

    // 2. Set up port forwarding
    let output = hidden_command("adb")
        .args(["-s", &serial, "forward", &format!("tcp:{}", LOCAL_PORT), "localabstract:scrcpy"])
        .output()
        .map_err(|e| format!("Failed to set up port forwarding: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Port forwarding failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // 3. Read stream settings from managed state
    let (max_size, bitrate, max_fps, audio_mode) = if let Some(settings_state) =
        app.try_state::<super::settings::SettingsState>()
    {
        let s = settings_state.0.lock().unwrap_or_else(|e| e.into_inner());
        (s.max_resolution, s.bitrate, s.max_fps, s.audio_mode)
    } else {
        (0, 8_000_000, 60, AudioMode::default())
    };

    // Only the duplicating mode depends on the Android version.
    let device_sdk = match audio_mode {
        AudioMode::Both => get_device_sdk(&serial),
        AudioMode::PcOnly | AudioMode::PhoneOnly => None,
    };
    let audio_setup = build_audio_setup(audio_mode, device_sdk);
    let audio_args = audio_setup.args.clone();

    // 4. Start scrcpy-server with control enabled
    let max_size_param = if max_size > 0 {
        format!("max_size={}", max_size)
    } else {
        String::new() // no limit = native resolution
    };

    let serial_clone = serial.clone();
    std::thread::spawn(move || {
        let _ = hidden_command("adb")
            .args([
                "-s",
                &serial_clone,
                "shell",
                &format!(
                    "CLASSPATH={} app_process / com.genymobile.scrcpy.Server {} \
                     tunnel_forward=true \
                     video=true \
                     {} \
                     control=true \
                     clipboard_autosync=false \
                     send_device_meta=true \
                     send_frame_meta=true \
                     send_dummy_byte=true \
                     send_codec_meta=true \
                     {} \
                     video_bit_rate={} \
                     max_fps={} \
                     video_codec=h264",
                    SCRCPY_SERVER_PATH,
                    SCRCPY_VERSION,
                    audio_args,
                    max_size_param,
                    bitrate,
                    max_fps
                ),
            ])
            .output();
    });

    // Give scrcpy-server time to start on the phone
    std::thread::sleep(Duration::from_millis(1000));

    // 4. Set up or reuse state
    let (stop_flag, control_socket, audio_socket, screen_width, screen_height) =
        if let Some(state) = app.try_state::<StreamState>() {
            // Reuse existing state (reconnection)
            let stop_flag = state.begin_session();
            *state.control_socket.lock().unwrap_or_else(|e| e.into_inner()) = None;
            *state.audio_socket.lock().unwrap_or_else(|e| e.into_inner()) = None;
            *state.screen_width.lock().unwrap_or_else(|e| e.into_inner()) = 0;
            *state.screen_height.lock().unwrap_or_else(|e| e.into_inner()) = 0;
            *state.recording_file.lock().unwrap_or_else(|e| e.into_inner()) = None;
            (
                stop_flag,
                state.control_socket.clone(),
                state.audio_socket.clone(),
                state.screen_width.clone(),
                state.screen_height.clone(),
            )
        } else {
            // First connection
            let stop_flag = Arc::new(AtomicBool::new(false));
            let control_socket: Arc<Mutex<Option<TcpStream>>> = Arc::new(Mutex::new(None));
            let audio_socket: Arc<Mutex<Option<TcpStream>>> = Arc::new(Mutex::new(None));
            let screen_width = Arc::new(Mutex::new(0u32));
            let screen_height = Arc::new(Mutex::new(0u32));

            app.manage(StreamState {
                stop_flag: Mutex::new(stop_flag.clone()),
                control_socket: control_socket.clone(),
                audio_socket: audio_socket.clone(),
                screen_width: screen_width.clone(),
                screen_height: screen_height.clone(),
                recording_file: Arc::new(Mutex::new(None)),
            });

            (stop_flag, control_socket, audio_socket, screen_width, screen_height)
        };

    let _ = app.emit("stream-status", "starting");

    let stop_flag_clone = stop_flag.clone();
    let control_socket_clone = control_socket.clone();
    let audio_socket_clone = audio_socket.clone();
    let screen_width_clone = screen_width.clone();
    let screen_height_clone = screen_height.clone();
    let audio_disabled_reason = audio_setup.disabled_reason;

    std::thread::spawn(move || {
        match connect_and_stream(
            &app,
            stop_flag_clone,
            control_socket_clone,
            audio_socket_clone,
            audio_disabled_reason,
            screen_width_clone,
            screen_height_clone,
        ) {
            Ok(()) => {
                // "disconnected" already emitted inside the stream loop — no extra event needed
            }
            Err(e) => {
                let _ = app.emit("stream-error", e.to_string());
            }
        }
    });

    Ok(())
}

fn connect_and_stream(
    app: &AppHandle,
    stop_flag: Arc<AtomicBool>,
    control_socket: Arc<Mutex<Option<TcpStream>>>,
    audio_socket: Arc<Mutex<Option<TcpStream>>>,
    audio_disabled_reason: Option<&'static str>,
    screen_width: Arc<Mutex<u32>>,
    screen_height: Arc<Mutex<u32>>,
) -> Result<(), String> {
    // In tunnel_forward mode with video + audio + control:
    // 1. Open video socket (first connection gets the dummy byte)
    // 2. Read dummy byte (0x00) on video socket
    // 3. Open audio socket
    // 4. Open control socket
    // 5. Then device meta + codec meta arrive on video socket, audio codec meta on audio socket

    // Socket 1: Video — connect and read dummy byte with retry
    // ADB forward accepts TCP immediately, but scrcpy-server may not be ready yet.
    // We retry the full connect + dummy byte read until it works.
    let mut video_stream: Option<TcpStream> = None;
    for attempt in 1..=MAX_CONNECT_RETRIES {
        if let Ok(mut s) = TcpStream::connect(format!("127.0.0.1:{}", LOCAL_PORT)) {
            s.set_read_timeout(Some(Duration::from_secs(2))).ok();
            let mut dummy = [0u8; 1];
            if s.read_exact(&mut dummy).is_ok() {
                video_stream = Some(s);
                break;
            }
            drop(s);
        }
        if attempt < MAX_CONNECT_RETRIES {
            std::thread::sleep(Duration::from_millis(CONNECT_RETRY_DELAY_MS));
        }
    }
    let mut video_stream = video_stream.ok_or("Failed to connect to scrcpy video socket")?;
    video_stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|e| format!("Failed to set timeout: {}", e))?;

    // Socket 2: Audio — connect after video dummy byte, before control.
    // With audio disabled the server accepts no audio socket, so connecting
    // here would steal the control socket's slot.
    if audio_disabled_reason.is_none() {
        match TcpStream::connect(format!("127.0.0.1:{}", LOCAL_PORT)) {
            Ok(audio_stream) => {
                eprintln!("[scrcpy] Audio socket connected successfully");
                *audio_socket.lock().unwrap_or_else(|e| e.into_inner()) = Some(audio_stream);
            }
            Err(e) => {
                eprintln!("[scrcpy] Audio socket FAILED: {}", e);
            }
        }
    }

    // Socket 3: Control — must connect after audio socket
    match TcpStream::connect(format!("127.0.0.1:{}", LOCAL_PORT)) {
        Ok(ctrl_stream) => {
            eprintln!("[scrcpy] Control socket connected successfully");
            *control_socket.lock().unwrap_or_else(|e| e.into_inner()) = Some(ctrl_stream);
        }
        Err(e) => {
            eprintln!("[scrcpy] Control socket FAILED: {}", e);
        }
    }

    // Spawn audio reader thread (reads codec meta + audio frames)
    match audio_disabled_reason {
        None => spawn_audio_reader(app, audio_socket.clone(), stop_flag.clone()),
        Some(reason) => {
            let _ = app.emit("audio-unavailable", reason);
        }
    }

    // Now read device metadata: 64 bytes device name
    let mut device_name_buf = [0u8; 64];
    video_stream
        .read_exact(&mut device_name_buf)
        .map_err(|e| format!("Failed to read device name: {}", e))?;

    let device_name = String::from_utf8_lossy(&device_name_buf)
        .trim_end_matches('\0')
        .to_string();
    let _ = app.emit("device-name", &device_name);

    // Read codec metadata: 12 bytes
    let mut codec_meta = [0u8; 12];
    video_stream
        .read_exact(&mut codec_meta)
        .map_err(|e| format!("Failed to read codec metadata: {}", e))?;

    let width = u32::from_be_bytes(codec_meta[4..8].try_into().unwrap());
    let height = u32::from_be_bytes(codec_meta[8..12].try_into().unwrap());

    *screen_width.lock().unwrap_or_else(|e| e.into_inner()) = width;
    *screen_height.lock().unwrap_or_else(|e| e.into_inner()) = height;

    let _ = app.emit(
        "stream-info",
        serde_json::json!({ "deviceName": device_name, "width": width, "height": height }),
    );

    let _ = app.emit("stream-status", "streaming");

    // Read video frames
    let mut header_buf = [0u8; 12];
    let encoder = base64::engine::general_purpose::STANDARD;

    loop {
        match read_full(&mut video_stream, &mut header_buf, &stop_flag) {
            Ok(ReadOutcome::Filled) => {}
            Ok(ReadOutcome::Stopped) => return Ok(()),
            Err(_) => {
                // Stream broken = device disconnected
                emit_if_running(app, &stop_flag, "stream-status", "disconnected");
                return Ok(());
            }
        }

        let pts_and_flags = u64::from_be_bytes(header_buf[0..8].try_into().unwrap());
        let is_config = (pts_and_flags >> 63) & 1 == 1;
        let is_key_frame = (pts_and_flags >> 62) & 1 == 1;
        let pts = pts_and_flags & 0x3FFF_FFFF_FFFF_FFFF;
        let size = u32::from_be_bytes(header_buf[8..12].try_into().unwrap()) as usize;

        if size == 0 {
            continue;
        }
        if size > MAX_VIDEO_PACKET_BYTES {
            // The header is garbage: the stream cannot be resynchronised.
            emit_if_running(app, &stop_flag, "stream-status", "disconnected");
            return Ok(());
        }

        let mut frame_data = vec![0u8; size];
        match read_full(&mut video_stream, &mut frame_data, &stop_flag) {
            Ok(ReadOutcome::Filled) => {}
            Ok(ReadOutcome::Stopped) => return Ok(()),
            Err(_) => {
                emit_if_running(app, &stop_flag, "stream-status", "disconnected");
                return Ok(());
            }
        }

        // Write to recording file if active (prepend Annex B start code)
        if let Some(state) = app.try_state::<StreamState>() {
            if let Ok(mut guard) = state.recording_file.lock() {
                if let Some((ref mut file, _)) = *guard {
                    let start_code: [u8; 4] = [0x00, 0x00, 0x00, 0x01];
                    let _ = file.write_all(&start_code);
                    let _ = file.write_all(&frame_data);
                }
            }
        }

        let b64 = encoder.encode(&frame_data);
        let _ = app.emit(
            "video-frame",
            serde_json::json!({
                "pts": pts,
                "size": size,
                "data": b64,
                "isConfig": is_config,
                "isKeyFrame": is_key_frame,
            }),
        );
    }
}

/// Take ownership of the audio socket and spawn a background reader thread.
/// Reads the 4-byte codec meta, emits `audio-info` or `audio-unavailable`,
/// then streams audio packets as `audio-frame` events.
fn spawn_audio_reader(
    app: &AppHandle,
    audio_socket: Arc<Mutex<Option<TcpStream>>>,
    stop_flag: Arc<AtomicBool>,
) {
    // Take the stream out of the mutex — the reader thread owns it exclusively.
    let mut stream = match audio_socket.lock().unwrap_or_else(|e| e.into_inner()).take() {
        Some(s) => s,
        None => {
            eprintln!("[scrcpy] Audio socket unavailable, skipping audio");
            let _ = app.emit("audio-unavailable", "socket-not-connected");
            return;
        }
    };

    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(e) = stream.set_read_timeout(Some(Duration::from_secs(5))) {
            eprintln!("[scrcpy-audio] Failed to set timeout: {}", e);
            return;
        }

        // Read 4-byte codec meta (FourCC). scrcpy sends 0 when audio is
        // disabled (Android < 11) and 1 when the capture failed.
        let mut codec_id_buf = [0u8; 4];
        if !matches!(
            read_full(&mut stream, &mut codec_id_buf, &stop_flag),
            Ok(ReadOutcome::Filled)
        ) {
            eprintln!("[scrcpy-audio] Failed to read codec meta");
            emit_if_running(&app, &stop_flag, "audio-unavailable", "capture-failed");
            return;
        }

        if codec_id_buf != AUDIO_CODEC_OPUS {
            eprintln!("[scrcpy-audio] Audio capture not started (meta {:?})", codec_id_buf);
            emit_if_running(&app, &stop_flag, "audio-unavailable", "capture-failed");
            return;
        }

        let codec = String::from_utf8_lossy(&codec_id_buf).trim_end_matches('\0').to_string();
        let _ = app.emit(
            "audio-info",
            serde_json::json!({ "codec": codec }),
        );

        read_audio_frames(&app, &mut stream, &stop_flag);
    });
}

/// Inner loop that reads scrcpy audio packets and emits them as Tauri events.
fn read_audio_frames(app: &AppHandle, stream: &mut TcpStream, stop_flag: &Arc<AtomicBool>) {
    let mut header_buf = [0u8; 12];
    let encoder = base64::engine::general_purpose::STANDARD;

    loop {
        match read_full(stream, &mut header_buf, stop_flag) {
            Ok(ReadOutcome::Filled) => {}
            Ok(ReadOutcome::Stopped) => return,
            Err(_) => {
                emit_if_running(app, stop_flag, "audio-status", "stopped");
                return;
            }
        }

        let pts_and_flags = u64::from_be_bytes(header_buf[0..8].try_into().unwrap());
        let is_config = (pts_and_flags >> 63) & 1 == 1;
        let is_key = (pts_and_flags >> 62) & 1 == 1;
        let pts = pts_and_flags & 0x3FFF_FFFF_FFFF_FFFF;
        let size = u32::from_be_bytes(header_buf[8..12].try_into().unwrap()) as usize;

        if size == 0 {
            continue;
        }
        if size > MAX_AUDIO_PACKET_BYTES {
            // The header is garbage: the stream cannot be resynchronised.
            emit_if_running(app, stop_flag, "audio-status", "stopped");
            return;
        }

        let mut data = vec![0u8; size];
        match read_full(stream, &mut data, stop_flag) {
            Ok(ReadOutcome::Filled) => {}
            Ok(ReadOutcome::Stopped) => return,
            Err(_) => {
                emit_if_running(app, stop_flag, "audio-status", "stopped");
                return;
            }
        }

        let b64 = encoder.encode(&data);
        let _ = app.emit(
            "audio-frame",
            serde_json::json!({
                "pts": pts,
                "isConfig": is_config,
                "isKey": is_key,
                "data": b64,
            }),
        );
    }
}

/// Build a scrcpy inject touch event message.
/// Verified against scrcpy v3.1 ControlMessageReader.java:
///   type:         u8  (2)
///   action:       u8
///   pointerId:    i64 (big-endian)
///   x:            i32 (big-endian)
///   y:            i32 (big-endian)
///   screenWidth:  u16 (big-endian)
///   screenHeight: u16 (big-endian)
///   pressure:     i16 (big-endian, 0x7FFF = max, 0 = none)
///   actionButton: i32 (big-endian)
///   buttons:      i32 (big-endian)
/// Total: 1 + 1 + 8 + 4 + 4 + 2 + 2 + 2 + 4 + 4 = 32 bytes
fn build_touch_message(
    action: u8,
    x: i32,
    y: i32,
    width: u16,
    height: u16,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(32);

    msg.push(CONTROL_MSG_INJECT_TOUCH);  // type
    msg.push(action);                     // action

    // pointerId: -1 as i64 for mouse
    msg.extend_from_slice(&(-1i64).to_be_bytes());

    // position
    msg.extend_from_slice(&x.to_be_bytes());
    msg.extend_from_slice(&y.to_be_bytes());

    // screen size
    msg.extend_from_slice(&width.to_be_bytes());
    msg.extend_from_slice(&height.to_be_bytes());

    // pressure: i16, 0x7FFF for down/move, 0 for up
    let pressure: i16 = if action == AMOTION_EVENT_ACTION_UP { 0 } else { 0x7FFF };
    msg.extend_from_slice(&pressure.to_be_bytes());

    // actionButton
    let action_button: i32 = if action == AMOTION_EVENT_ACTION_DOWN { 1 } else { 0 };
    msg.extend_from_slice(&action_button.to_be_bytes());

    // buttons (currently held)
    let buttons: i32 = if action == AMOTION_EVENT_ACTION_UP { 0 } else { 1 };
    msg.extend_from_slice(&buttons.to_be_bytes());

    msg
}

/// Build a scrcpy inject scroll event message.
/// Verified against scrcpy v3.1 ControlMessageReader.java:
///   type:         u8  (3)
///   x:            i32 (big-endian)
///   y:            i32 (big-endian)
///   screenWidth:  u16 (big-endian)
///   screenHeight: u16 (big-endian)
///   hScroll:      i16 (big-endian, float encoded as fixed-point)
///   vScroll:      i16 (big-endian, float encoded as fixed-point)
///   buttons:      i32 (big-endian)
/// Total: 1 + 4 + 4 + 2 + 2 + 2 + 2 + 4 = 21 bytes
/// Convert a float [-1.0, 1.0] to scrcpy i16 fixed-point format.
/// scrcpy expects: i16fp where 1.0 = 0x7FFF (32767), -1.0 = -0x8000
fn float_to_i16fp(f: f32) -> i16 {
    let clamped = f.clamp(-1.0, 1.0);
    if clamped == 1.0 {
        return i16::MAX; // 32767
    }
    (clamped * 0x8000 as f32) as i16
}

fn build_scroll_message(
    x: i32,
    y: i32,
    width: u16,
    height: u16,
    scroll_v: f32,
    scroll_h: f32,
) -> Vec<u8> {
    let mut msg = Vec::with_capacity(21);

    msg.push(CONTROL_MSG_INJECT_SCROLL);  // type

    // position
    msg.extend_from_slice(&x.to_be_bytes());
    msg.extend_from_slice(&y.to_be_bytes());

    // screen size
    msg.extend_from_slice(&width.to_be_bytes());
    msg.extend_from_slice(&height.to_be_bytes());

    // hScroll — normalized float → i16 fixed-point
    msg.extend_from_slice(&float_to_i16fp(scroll_h).to_be_bytes());

    // vScroll — normalized float → i16 fixed-point
    msg.extend_from_slice(&float_to_i16fp(scroll_v).to_be_bytes());

    // buttons
    msg.extend_from_slice(&0i32.to_be_bytes());

    msg
}

#[tauri::command]
pub async fn inject_touch(
    app: AppHandle,
    action: u8,
    x: f64,
    y: f64,
) -> Result<(), String> {
    let state = app
        .try_state::<StreamState>()
        .ok_or("Stream not active")?;

    let width = *state.screen_width.lock().unwrap_or_else(|e| e.into_inner());
    let height = *state.screen_height.lock().unwrap_or_else(|e| e.into_inner());

    if width == 0 || height == 0 {
        return Err("Screen dimensions not known yet".to_string());
    }

    let msg = build_touch_message(action, x as i32, y as i32, width as u16, height as u16);

    let mut guard = state.control_socket.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(ref mut socket) = *guard {
        socket.write_all(&msg).map_err(|e| format!("Failed to send touch: {}", e))?;
        socket.flush().map_err(|e| format!("Failed to flush: {}", e))?;
    } else {
        return Err("Control socket not connected".to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn inject_scroll(
    app: AppHandle,
    x: f64,
    y: f64,
    scroll_v: f64,
    scroll_h: f64,
) -> Result<(), String> {
    let state = app
        .try_state::<StreamState>()
        .ok_or("Stream not active")?;

    let width = *state.screen_width.lock().unwrap_or_else(|e| e.into_inner());
    let height = *state.screen_height.lock().unwrap_or_else(|e| e.into_inner());

    if width == 0 || height == 0 {
        return Err("Screen dimensions not known yet".to_string());
    }

    // Normalize: input is in [-16, 16] range (like scrcpy), clamp to [-1, 1]
    let v_norm = (scroll_v / 16.0).clamp(-1.0, 1.0) as f32;
    let h_norm = (scroll_h / 16.0).clamp(-1.0, 1.0) as f32;

    let msg = build_scroll_message(x as i32, y as i32, width as u16, height as u16, v_norm, h_norm);

    let mut guard = state.control_socket.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(ref mut socket) = *guard {
        socket.write_all(&msg).map_err(|e| format!("Failed to send scroll: {}", e))?;
        socket.flush().map_err(|e| format!("Failed to flush: {}", e))?;
    } else {
        return Err("Control socket not connected".to_string());
    }

    Ok(())
}

/// Build a scrcpy inject keycode message.
/// Format from ControlMessageReader.java:
///   type:      u8  (0)
///   action:    u8  (0=DOWN, 1=UP)
///   keycode:   i32 (Android AKEYCODE_*)
///   repeat:    i32
///   metaState: i32
/// Total: 1 + 1 + 4 + 4 + 4 = 14 bytes
pub(crate) fn build_keycode_message(action: u8, keycode: i32, repeat: i32, meta_state: i32) -> Vec<u8> {
    let mut msg = Vec::with_capacity(14);
    msg.push(CONTROL_MSG_INJECT_KEYCODE);
    msg.push(action);
    msg.extend_from_slice(&keycode.to_be_bytes());
    msg.extend_from_slice(&repeat.to_be_bytes());
    msg.extend_from_slice(&meta_state.to_be_bytes());
    msg
}

/// Build a scrcpy inject text message.
/// Format from ControlMessageReader.java:
///   type:   u8  (1)
///   length: i32 (big-endian, byte length of text)
///   text:   [u8] (UTF-8 encoded)
/// Total: 1 + 4 + N bytes
pub(crate) fn build_text_message(text: &str) -> Vec<u8> {
    let text_bytes = text.as_bytes();
    let mut msg = Vec::with_capacity(5 + text_bytes.len());
    msg.push(CONTROL_MSG_INJECT_TEXT);
    msg.extend_from_slice(&(text_bytes.len() as i32).to_be_bytes());
    msg.extend_from_slice(text_bytes);
    msg
}

/// Build a back-or-screen-on message (type 4).
/// Format: type: u8 (4), action: u8
/// Total: 2 bytes
fn build_back_or_screen_on_message(action: u8) -> Vec<u8> {
    vec![CONTROL_MSG_BACK_OR_SCREEN_ON, action]
}

/// Build a SET_CLIPBOARD message (type 9) for scrcpy v3.1.
/// Format:
///   type:     u8  (9)
///   sequence: i64 (big-endian) — 0 to ignore ACK
///   paste:    u8  (1 = paste after setting clipboard)
///   length:   i32 (big-endian)
///   text:     [u8] (UTF-8)
fn build_set_clipboard_message(text: &str, paste: bool) -> Vec<u8> {
    let text_bytes = text.as_bytes();
    let mut msg = Vec::with_capacity(14 + text_bytes.len());
    msg.push(CONTROL_MSG_SET_CLIPBOARD);
    msg.extend_from_slice(&0i64.to_be_bytes()); // sequence
    msg.push(if paste { 1 } else { 0 });
    msg.extend_from_slice(&(text_bytes.len() as i32).to_be_bytes());
    msg.extend_from_slice(text_bytes);
    msg
}

pub(crate) fn send_control_message(state: &StreamState, msg: &[u8]) -> Result<(), String> {
    let mut guard = state.control_socket.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(ref mut socket) = *guard {
        socket.write_all(msg).map_err(|e| format!("Failed to send control message: {}", e))?;
        socket.flush().map_err(|e| format!("Failed to flush: {}", e))?;
        Ok(())
    } else {
        Err("Control socket not connected".to_string())
    }
}

/// Inject a keycode (press + release) on the phone.
/// Used for special keys: Back, Home, Volume, etc.
#[tauri::command]
pub async fn inject_keycode(
    app: AppHandle,
    keycode: i32,
    meta_state: Option<i32>,
) -> Result<(), String> {
    let state = app.try_state::<StreamState>().ok_or("Stream not active")?;
    let meta = meta_state.unwrap_or(0);

    let down = build_keycode_message(AKEY_EVENT_ACTION_DOWN, keycode, 0, meta);
    send_control_message(&state, &down)?;

    let up = build_keycode_message(AKEY_EVENT_ACTION_UP, keycode, 0, meta);
    send_control_message(&state, &up)?;

    Ok(())
}

/// Inject text directly (for typing in text fields).
#[tauri::command]
pub async fn inject_text(app: AppHandle, text: String) -> Result<(), String> {
    let state = app.try_state::<StreamState>().ok_or("Stream not active")?;
    let msg = build_text_message(&text);
    send_control_message(&state, &msg)
}

/// Send back-or-screen-on (press + release).
#[tauri::command]
pub async fn press_back(app: AppHandle) -> Result<(), String> {
    let state = app.try_state::<StreamState>().ok_or("Stream not active")?;
    let down = build_back_or_screen_on_message(AKEY_EVENT_ACTION_DOWN);
    send_control_message(&state, &down)?;
    let up = build_back_or_screen_on_message(AKEY_EVENT_ACTION_UP);
    send_control_message(&state, &up)
}

/// Set the phone clipboard content and optionally paste it.
#[tauri::command]
pub async fn set_phone_clipboard(
    app: AppHandle,
    text: String,
    paste: Option<bool>,
) -> Result<(), String> {
    let state = app.try_state::<StreamState>().ok_or("Stream not active")?;
    let msg = build_set_clipboard_message(&text, paste.unwrap_or(true));
    send_control_message(&state, &msg)
}

/// Get the phone clipboard content via scrcpy GET_CLIPBOARD protocol.
/// Sends GET_CLIPBOARD control message and reads the device response.
#[tauri::command]
pub async fn get_phone_clipboard(app: AppHandle) -> Result<String, String> {
    let state = app.try_state::<StreamState>().ok_or("Stream not active")?;

    let mut guard = state.control_socket.lock().unwrap_or_else(|e| e.into_inner());
    let socket = guard.as_mut().ok_or("Control socket not connected")?;

    // The server is started with clipboard_autosync=false, so the only device
    // message expected here is the answer to this request. Still discard
    // leftovers (an answer that arrived after an earlier call timed out).
    drain_pending(socket);

    // Send GET_CLIPBOARD message: type(1) + copy_key(1) = 2 bytes
    // copy_key: 0 = COPY_KEY_NONE (just get, don't trigger copy)
    let msg = [CONTROL_MSG_GET_CLIPBOARD, 0u8];
    socket.write_all(&msg).map_err(|e| format!("Failed to send GET_CLIPBOARD: {}", e))?;
    socket.flush().map_err(|e| format!("Failed to flush: {}", e))?;

    socket
        .set_read_timeout(Some(CLIPBOARD_RESPONSE_TIMEOUT))
        .map_err(|e| format!("Failed to set timeout: {}", e))?;
    let response = read_clipboard_response(socket);
    socket.set_read_timeout(None).ok();

    if response.is_err() {
        // A half-read message would corrupt the next request.
        drain_pending(socket);
    }
    response
}

/// Discard every byte currently readable on `socket` without blocking.
fn drain_pending(socket: &mut TcpStream) {
    if socket.set_nonblocking(true).is_err() {
        return;
    }
    let mut scratch = [0u8; 4096];
    while matches!(socket.read(&mut scratch), Ok(read) if read > 0) {}
    let _ = socket.set_nonblocking(false);
}

/// Read one scrcpy device message and return its clipboard text.
/// Layout: type(1) + clipboard_length(4, big-endian) + clipboard_text(N).
fn read_clipboard_response(socket: &mut TcpStream) -> Result<String, String> {
    let mut type_buf = [0u8; 1];
    socket
        .read_exact(&mut type_buf)
        .map_err(|_| "No clipboard response from device".to_string())?;
    if type_buf[0] != DEVICE_MSG_TYPE_CLIPBOARD {
        return Err(format!("Unexpected device message type: {}", type_buf[0]));
    }

    let mut len_buf = [0u8; 4];
    socket
        .read_exact(&mut len_buf)
        .map_err(|e| format!("Failed to read clipboard length: {}", e))?;
    let text_len = usize::try_from(i32::from_be_bytes(len_buf))
        .ok()
        .filter(|len| *len <= MAX_CLIPBOARD_BYTES)
        .ok_or("Invalid clipboard length from device")?;

    let mut text_buf = vec![0u8; text_len];
    socket
        .read_exact(&mut text_buf)
        .map_err(|e| format!("Failed to read clipboard text: {}", e))?;

    String::from_utf8(text_buf).map_err(|e| format!("Invalid clipboard UTF-8: {}", e))
}

#[tauri::command]
pub async fn stop_stream(app: AppHandle, serial: String) -> Result<(), String> {
    super::adb::validate_serial(&serial)?;
    if let Some(state) = app.try_state::<StreamState>() {
        state.stop_session();
    }

    let _ = hidden_command("adb")
        .args(["-s", &serial, "forward", "--remove", &format!("tcp:{}", LOCAL_PORT)])
        .output();

    let _ = app.emit("stream-status", "stopped");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_duplicate_audio_when_both_mode_on_android_13() {
        let setup = build_audio_setup(AudioMode::Both, Some(ANDROID_13_SDK));
        assert!(setup.args.contains("audio_source=playback"));
        assert!(setup.args.contains("audio_dup=true"));
        assert_eq!(setup.disabled_reason, None);
    }

    #[test]
    fn should_skip_capture_when_both_mode_on_older_android() {
        let setup = build_audio_setup(AudioMode::Both, Some(ANDROID_13_SDK - 1));
        assert_eq!(setup.args, "audio=false");
        assert_eq!(setup.disabled_reason, Some("requires-android-13"));
    }

    #[test]
    fn should_skip_capture_when_both_mode_and_sdk_unknown() {
        let setup = build_audio_setup(AudioMode::Both, None);
        assert_eq!(setup.args, "audio=false");
    }

    #[test]
    fn should_capture_device_output_when_pc_only_mode() {
        let setup = build_audio_setup(AudioMode::PcOnly, None);
        assert!(setup.args.contains("audio_source=output"));
        assert!(!setup.args.contains("audio_dup"));
        assert_eq!(setup.disabled_reason, None);
    }

    #[test]
    fn should_disable_audio_when_phone_only_mode() {
        let setup = build_audio_setup(AudioMode::PhoneOnly, Some(ANDROID_13_SDK));
        assert_eq!(setup.args, "audio=false");
        assert_eq!(setup.disabled_reason, Some("phone-only"));
    }

    #[test]
    fn test_build_touch_message_size() {
        let msg = build_touch_message(0, 100, 200, 1080, 1920);
        assert_eq!(msg.len(), 32, "Touch message should be 32 bytes");
    }

    #[test]
    fn test_build_touch_message_type() {
        let msg = build_touch_message(0, 0, 0, 100, 100);
        assert_eq!(msg[0], CONTROL_MSG_INJECT_TOUCH);
    }

    #[test]
    fn test_build_touch_message_action() {
        let down = build_touch_message(AMOTION_EVENT_ACTION_DOWN, 0, 0, 100, 100);
        assert_eq!(down[1], 0); // ACTION_DOWN = 0

        let up = build_touch_message(AMOTION_EVENT_ACTION_UP, 0, 0, 100, 100);
        assert_eq!(up[1], 1); // ACTION_UP = 1
    }

    #[test]
    fn test_build_touch_message_coordinates() {
        let msg = build_touch_message(0, 500, 1000, 1080, 1920);
        // Bytes 10-13 = x (i32 BE), bytes 14-17 = y (i32 BE)
        let x = i32::from_be_bytes(msg[10..14].try_into().unwrap());
        let y = i32::from_be_bytes(msg[14..18].try_into().unwrap());
        assert_eq!(x, 500);
        assert_eq!(y, 1000);
    }

    #[test]
    fn test_build_touch_message_screen_size() {
        let msg = build_touch_message(0, 0, 0, 1080, 1920);
        let w = u16::from_be_bytes(msg[18..20].try_into().unwrap());
        let h = u16::from_be_bytes(msg[20..22].try_into().unwrap());
        assert_eq!(w, 1080);
        assert_eq!(h, 1920);
    }

    #[test]
    fn test_build_touch_message_pressure_down() {
        let msg = build_touch_message(AMOTION_EVENT_ACTION_DOWN, 0, 0, 100, 100);
        let pressure = i16::from_be_bytes(msg[22..24].try_into().unwrap());
        assert_eq!(pressure, 0x7FFF); // max pressure for down
    }

    #[test]
    fn test_build_touch_message_pressure_up() {
        let msg = build_touch_message(AMOTION_EVENT_ACTION_UP, 0, 0, 100, 100);
        let pressure = i16::from_be_bytes(msg[22..24].try_into().unwrap());
        assert_eq!(pressure, 0); // zero pressure for up
    }

    #[test]
    fn test_build_scroll_message_size() {
        let msg = build_scroll_message(100, 200, 1080, 1920, 1.0, 0.0);
        assert_eq!(msg.len(), 21, "Scroll message should be 21 bytes");
    }

    #[test]
    fn test_build_scroll_message_type() {
        let msg = build_scroll_message(0, 0, 100, 100, 0.0, 0.0);
        assert_eq!(msg[0], CONTROL_MSG_INJECT_SCROLL);
    }

    #[test]
    fn test_float_to_i16fp_max() {
        assert_eq!(float_to_i16fp(1.0), i16::MAX); // 32767
    }

    #[test]
    fn test_float_to_i16fp_zero() {
        assert_eq!(float_to_i16fp(0.0), 0);
    }

    #[test]
    fn test_float_to_i16fp_negative() {
        let result = float_to_i16fp(-1.0);
        assert!(result < 0);
    }

    #[test]
    fn test_float_to_i16fp_clamp() {
        // Values > 1.0 should be clamped
        assert_eq!(float_to_i16fp(5.0), i16::MAX);
        // Values < -1.0 should be clamped
        let result = float_to_i16fp(-5.0);
        assert!(result < 0);
    }

    #[test]
    fn test_build_keycode_message_size() {
        let msg = build_keycode_message(0, 66, 0, 0);
        assert_eq!(msg.len(), 14, "Keycode message should be 14 bytes");
    }

    #[test]
    fn test_build_keycode_message_type() {
        let msg = build_keycode_message(0, 66, 0, 0);
        assert_eq!(msg[0], CONTROL_MSG_INJECT_KEYCODE);
    }

    #[test]
    fn test_build_keycode_message_keycode() {
        let msg = build_keycode_message(0, 66, 0, 0); // ENTER = 66
        let keycode = i32::from_be_bytes(msg[2..6].try_into().unwrap());
        assert_eq!(keycode, 66);
    }

    #[test]
    fn test_build_text_message() {
        let msg = build_text_message("hello");
        assert_eq!(msg[0], CONTROL_MSG_INJECT_TEXT);
        let len = i32::from_be_bytes(msg[1..5].try_into().unwrap());
        assert_eq!(len, 5);
        assert_eq!(&msg[5..], b"hello");
    }

    #[test]
    fn test_build_text_message_unicode() {
        let msg = build_text_message("café");
        let len = i32::from_be_bytes(msg[1..5].try_into().unwrap()) as usize;
        assert_eq!(len, "café".len()); // 5 bytes in UTF-8
        assert_eq!(&msg[5..5 + len], "café".as_bytes());
    }

    #[test]
    fn test_build_set_clipboard_message() {
        let msg = build_set_clipboard_message("test", true);
        assert_eq!(msg[0], CONTROL_MSG_SET_CLIPBOARD);
        // sequence: 8 bytes (all zeros)
        assert_eq!(&msg[1..9], &[0u8; 8]);
        // paste: 1
        assert_eq!(msg[9], 1);
        // text length
        let len = i32::from_be_bytes(msg[10..14].try_into().unwrap());
        assert_eq!(len, 4);
        // text data
        assert_eq!(&msg[14..], b"test");
    }

    #[test]
    fn test_build_set_clipboard_no_paste() {
        let msg = build_set_clipboard_message("x", false);
        assert_eq!(msg[9], 0); // paste = false
    }
}

#[cfg(test)]
mod session_tests {
    use super::*;
    use std::net::TcpListener;

    fn connected_pair() -> (TcpStream, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let client = TcpStream::connect(listener.local_addr().unwrap()).unwrap();
        let (server, _) = listener.accept().unwrap();
        (client, server)
    }

    #[test]
    fn should_keep_partial_bytes_when_read_times_out_mid_packet() {
        let (mut reader, mut writer) = connected_pair();
        reader.set_read_timeout(Some(Duration::from_millis(50))).unwrap();
        let stop_flag = AtomicBool::new(false);

        let sender = std::thread::spawn(move || {
            writer.write_all(&[1, 2]).unwrap();
            std::thread::sleep(Duration::from_millis(200));
            writer.write_all(&[3, 4]).unwrap();
        });

        let mut buf = [0u8; 4];
        let outcome = read_full(&mut reader, &mut buf, &stop_flag).unwrap();
        sender.join().unwrap();

        assert!(matches!(outcome, ReadOutcome::Filled));
        assert_eq!(buf, [1, 2, 3, 4]);
    }

    #[test]
    fn should_stop_reading_when_session_is_stopped() {
        let (mut reader, _writer) = connected_pair();
        reader.set_read_timeout(Some(Duration::from_millis(50))).unwrap();
        let stop_flag = AtomicBool::new(true);

        let mut buf = [0u8; 4];
        let outcome = read_full(&mut reader, &mut buf, &stop_flag).unwrap();

        assert!(matches!(outcome, ReadOutcome::Stopped));
    }

    #[test]
    fn should_fail_when_peer_closes_the_connection() {
        let (mut reader, writer) = connected_pair();
        drop(writer);
        let stop_flag = AtomicBool::new(false);

        let mut buf = [0u8; 4];
        assert!(read_full(&mut reader, &mut buf, &stop_flag).is_err());
    }

    #[test]
    fn should_give_each_session_its_own_stop_flag() {
        let state = StreamState {
            stop_flag: Mutex::new(Arc::new(AtomicBool::new(false))),
            control_socket: Arc::new(Mutex::new(None)),
            audio_socket: Arc::new(Mutex::new(None)),
            screen_width: Arc::new(Mutex::new(0)),
            screen_height: Arc::new(Mutex::new(0)),
            recording_file: Arc::new(Mutex::new(None)),
        };
        let first_session = state.stop_flag();

        state.stop_session();
        let second_session = state.begin_session();

        assert!(first_session.load(Ordering::Relaxed));
        assert!(!second_session.load(Ordering::Relaxed));
    }
}
