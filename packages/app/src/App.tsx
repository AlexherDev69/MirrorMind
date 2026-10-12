import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VideoCanvas } from "./features/streaming/presentation/components/VideoCanvas";
import { AudioControl } from "./features/streaming/presentation/components/AudioControl";
import { DeviceStatus } from "./features/device-detection/presentation/components/DeviceStatus";
import { McpStatus } from "./features/internal-api/presentation/components/McpStatus";
import { CaptureConsentModal } from "./features/internal-api/presentation/components/CaptureConsentModal";
import { OnboardingWizard } from "./features/onboarding/presentation/components/OnboardingWizard";
import { SettingsToggle } from "./features/settings/presentation/components/SettingsToggle";
import { CaptureButtons } from "./features/settings/presentation/components/CaptureButtons";
import { useSettingsStore } from "./features/settings/presentation/stores/settings.store";
import { ToastContainer, Icon, Button, FadeTransition } from "./core/components";
import { LogcatPanel } from "./features/logcat/presentation/components/LogcatPanel";
import { useLogcatStore } from "./features/logcat/presentation/stores/logcat.store";
import { RecorderIndicator } from "./features/action-recorder/presentation/components/RecorderIndicator";
import { MacrosLibraryModal } from "./features/action-recorder/presentation/components/MacrosLibraryModal";
import { startLogcat, stopLogcat, clearLogcat } from "./features/logcat/data/logcat-service";
import { useDevicePolling, type AdbDevice, type AppState } from "./core/hooks/useDevicePolling";
import { useStreamEvents } from "./core/hooks/useStreamEvents";
import { useAudioStream } from "./core/hooks/useAudioStream";
import { useStreamStarter } from "./core/hooks/useStreamStarter";
import { useWifiSession } from "./core/hooks/useWifiSession";
import { useWindowModes } from "./core/hooks/useWindowModes";
import { useAppVersion } from "./core/hooks/useAppVersion";
import { formatStreamError } from "./core/stream-error";
import { useClipboardShortcut } from "./features/clipboard/presentation/useClipboardShortcut";
import { WifiStatusBadge } from "./features/wifi-mode/presentation/components/WifiStatusBadge";
import { WifiConnectModal } from "./features/wifi-mode/presentation/components/WifiConnectModal";
import { WifiPairingModal } from "./features/wifi-mode/presentation/components/WifiPairingModal";
import { WifiSecurityWarning } from "./features/wifi-mode/presentation/components/WifiSecurityWarning";
import { isWifiSerial } from "./features/wifi-mode/presentation/wifi-serial";
import { showToast } from "./core/components/Toast";

function App() {
  const [appState, setAppState] = useState<AppState>("no-device");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [device, setDevice] = useState<AdbDevice | null>(null);
  const [adbAvailable, setAdbAvailable] = useState<boolean | null>(null);
  const [showMacros, setShowMacros] = useState(false);
  const [showWifiConnect, setShowWifiConnect] = useState(false);
  const [showWifiPair, setShowWifiPair] = useState(false);
  const appStateRef = useRef<AppState>("no-device");
  const currentWifi = isWifiSerial(device?.serial ?? "");
  const appVersion = useAppVersion();
  const { isMiniPlayer, isFullscreen, toggleMiniPlayer, toggleFullscreen } = useWindowModes();
  const { handleReturnToUsb } = useWifiSession(device, adbAvailable);
  const startStream = useStreamStarter({ setAppState, setErrorMessage });

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    loadSettings();
    invoke<string>("check_adb_available")
      .then(() => setAdbAvailable(true))
      .catch(() => setAdbAvailable(false));
  }, [loadSettings]);

  const handleOnboardingComplete = useCallback(
    (dev: AdbDevice) => {
      setDevice(dev);
      startStream(dev);
    },
    [startStream],
  );

  // Device polling
  useDevicePolling({
    adbAvailable,
    appStateRef,
    onAuthorizedDevice: useCallback((dev, isOnboarded) => {
      setDevice(dev);
      if (isOnboarded) {
        startStream(dev);
      } else {
        setAppState("onboarding");
      }
    }, [startStream]),
    onUnauthorizedDevice: useCallback((dev) => {
      setDevice(dev);
      setAppState("onboarding");
    }, []),
    onDeviceLost: useCallback(() => {
      const current = appStateRef.current;
      if (current === "streaming" || current === "connecting") {
        setAppState("disconnected");
      } else {
        setAppState("no-device");
      }
      setDevice(null);
    }, []),
    onReconnect: useCallback((dev) => {
      setDevice(dev);
      startStream(dev);
    }, [startStream]),
  });

  // Clipboard shortcut: Ctrl+Shift+V → paste PC clipboard to phone
  useClipboardShortcut(appState === "streaming");

  // Audio stream (Opus decoding + WebAudio playback)
  useAudioStream();

  // Stream events
  useStreamEvents({
    appStateRef,
    onStreaming: useCallback(() => {
      setAppState("streaming");
      // Auto-start logcat when stream starts
      if (device?.serial) startLogcat(device.serial).catch(() => {});
    }, [device]),
    onDisconnected: useCallback(() => {
      setAppState("disconnected");
      stopLogcat().catch(() => {});
    }, []),
    onStopped: useCallback(() => {
      setAppState("no-device");
      stopLogcat().catch(() => {});
    }, []),
    onError: useCallback((msg) => {
      setAppState("error");
      setErrorMessage(formatStreamError(msg));
    }, []),
  });

  if (adbAvailable === false) {
    return (
      <div className="flex flex-col h-full bg-zinc-950 items-center justify-center gap-4 px-8">
        <div className="w-16 h-16 rounded-full bg-red-950 flex items-center justify-center">
          <Icon name="error" className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 text-sm text-center">ADB not found</p>
        <p className="text-zinc-500 text-xs text-center">
          Install Android SDK Platform Tools and add adb to your PATH
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Mini-player overlay: drag bar + restore button */}
      {isMiniPlayer && appState === "streaming" && (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between">
          {/* Drag handle — uses Tauri startDragging API */}
          <div
            className="flex-1 h-7 cursor-move opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-b from-black/60 to-transparent"
            onMouseDown={async (e) => {
              if (e.button === 0) {
                e.preventDefault();
                e.stopPropagation();
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                await getCurrentWindow().startDragging();
              }
            }}
          />
          {/* Restore button — right corner */}
          <button
            onClick={() => toggleMiniPlayer()}
            className="w-7 h-7 flex items-center justify-center bg-black/50 hover:bg-black/80 text-zinc-400 hover:text-white transition-colors rounded-bl"
            title="Exit mini-player"
            aria-label="Exit mini-player"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      )}

      {/* Fullscreen exit button — visible on hover at top */}
      {isFullscreen && appState === "streaming" && (
        <div className="absolute top-0 left-0 right-0 h-10 z-20 group">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center h-full bg-black/60">
            <button
              onClick={() => toggleFullscreen()}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition-colors"
            >
              Exit fullscreen
            </button>
          </div>
        </div>
      )}

      <header className={`flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 ${isMiniPlayer || isFullscreen ? "hidden" : ""}`}>
        <h1 className="text-sm font-semibold text-zinc-200">MirrorMind</h1>
        <div className="flex items-center gap-1">
          {/* Capture group */}
          {appState === "streaming" && (
            <>
              <CaptureButtons />
              <div className="w-px h-4 bg-zinc-700 mx-1" />
            </>
          )}
          {/* Dev tools group */}
          {appState === "streaming" && (
            <>
              <MacrosToggle onOpen={() => setShowMacros(true)} />
              <LogcatToggle />
              <div className="w-px h-4 bg-zinc-700 mx-1" />
            </>
          )}
          {/* Window group */}
          {appState === "streaming" && (
            <>
              <AudioControl />
              <MiniPlayerToggle isMini={isMiniPlayer} onToggle={() => toggleMiniPlayer()} />
              <FullscreenToggle onToggle={() => toggleFullscreen()} />
              <div className="w-px h-4 bg-zinc-700 mx-1" />
            </>
          )}
          {/* Settings + Status */}
          {device && appState === "streaming" && !currentWifi && (
            <button
              onClick={() => setShowWifiConnect(true)}
              className="text-[11px] px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-200 transition-colors"
              title="Switch to WiFi"
            >
              Switch to WiFi
            </button>
          )}
          <button
            onClick={() => setShowWifiPair(true)}
            className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            title="Pair with Wireless Debugging (Android 11+)"
          >
            Pair
          </button>
          <SettingsToggle />
          <McpStatus />
          <WifiStatusBadge />
          <DeviceStatus state={appState} />
        </div>
      </header>

      <RecorderIndicator />

      <main className="flex-1 flex items-center justify-center overflow-hidden">
        <FadeTransition transitionKey={appState}>
          {(appState === "no-device" || appState === "onboarding") && (
            <OnboardingWizard device={device} onComplete={handleOnboardingComplete} />
          )}

          {appState === "connecting" && (
            <div className="flex flex-col items-center gap-4">
              <Icon name="spinner" className="w-8 h-8 text-purple-500" />
              <p className="text-zinc-400 text-sm">Connecting to {device?.model ?? "device"}...</p>
            </div>
          )}

          {appState === "streaming" && <VideoCanvas />}

          {appState === "disconnected" && (
            <div className="flex flex-col items-center gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-yellow-950 flex items-center justify-center">
                <Icon name="eye-off" className="w-8 h-8 text-yellow-400" />
              </div>
              <p className="text-yellow-400 text-sm">Device disconnected</p>
              <div className="flex items-center gap-2">
                <Icon name="spinner" className="w-3 h-3 text-yellow-500" />
                <p className="text-zinc-500 text-xs">Waiting for reconnection...</p>
              </div>
            </div>
          )}

          {appState === "error" && (
            <div className="flex flex-col items-center gap-4 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-red-950 flex items-center justify-center">
                <Icon name="error" className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-red-400 text-sm">{errorMessage}</p>
              <Button
                variant="secondary"
                className="text-xs"
                onClick={() => { setAppState("no-device"); setDevice(null); }}
              >
                Retry
              </Button>
            </div>
          )}
        </FadeTransition>
      </main>

      {/* Logcat panel (below main, above footer) — hidden in mini mode */}
      {!isMiniPlayer && !isFullscreen && (
        <LogcatPanel
          serial={device?.serial ?? null}
          onClear={() => { if (device) clearLogcat(device.serial).catch(() => {}); }}
        />
      )}

      {showMacros && <MacrosLibraryModal onClose={() => setShowMacros(false)} />}
      {showWifiConnect && device && (
        <WifiConnectModal
          usbSerial={device.serial}
          onClose={() => setShowWifiConnect(false)}
          onConnected={(wifiSerial) => {
            setShowWifiConnect(false);
            setDevice({ serial: wifiSerial, state: "device", model: device.model });
            startStream({ serial: wifiSerial, state: "device", model: device.model });
          }}
        />
      )}
      {showWifiPair && (
        <WifiPairingModal
          onClose={() => setShowWifiPair(false)}
          onPaired={(wifiSerial) => {
            setShowWifiPair(false);
            showToast("Paired over WiFi.", "success");
            setDevice({ serial: wifiSerial, state: "device", model: "WiFi device" });
            startStream({ serial: wifiSerial, state: "device", model: "WiFi device" });
          }}
        />
      )}
      {currentWifi && appState === "streaming" && !isMiniPlayer && !isFullscreen && (
        <div className="px-3 pt-2">
          <WifiSecurityWarning onReturnToUsb={handleReturnToUsb} />
        </div>
      )}
      <CaptureConsentModal />
      <ToastContainer />

      <footer className={`flex items-center justify-between px-4 py-1.5 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-500 ${isMiniPlayer || isFullscreen ? "hidden" : ""}`}>
        <span>{device ? `${device.model} (${device.serial})` : "No device"}</span>
        <span>{appVersion ? `v${appVersion}` : ""}</span>
      </footer>
    </div>
  );
}

/** Toggle button for the logcat panel in the header. */
function LogcatToggle() {
  const { isOpen, toggleOpen } = useLogcatStore();

  return (
    <button
      onClick={toggleOpen}
      className={`flex items-center justify-center w-7 h-7 rounded transition-colors group ${
        isOpen ? "bg-purple-900/50" : "hover:bg-zinc-800"
      }`}
      title="Toggle Logcat (Ctrl+L)"
      aria-label="Toggle Logcat"
    >
      <Icon name="terminal" className={`w-4 h-4 ${isOpen ? "text-purple-400" : "text-zinc-400 group-hover:text-zinc-200"}`} />
    </button>
  );
}

/** PiP toggle button in the header. */
function MiniPlayerToggle({ isMini, onToggle }: { readonly isMini: boolean; readonly onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors group"
      title={isMini ? "Exit mini-player (Ctrl+Shift+M)" : "Mini-player (Ctrl+Shift+M)"}
      aria-label={isMini ? "Exit mini-player" : "Mini-player"}
    >
      <Icon name="pip" className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
    </button>
  );
}

/** Macros library toggle button in the header. */
function MacrosToggle({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors group"
      title="Macros library"
      aria-label="Macros library"
    >
      <Icon name="macros" className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
    </button>
  );
}

/** Fullscreen toggle button in the header. */
function FullscreenToggle({ onToggle }: { readonly onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-center w-7 h-7 rounded hover:bg-zinc-800 transition-colors group"
      title="Fullscreen (F11)"
      aria-label="Fullscreen"
    >
      <Icon name="fullscreen" className="w-4 h-4 text-zinc-400 group-hover:text-zinc-200" />
    </button>
  );
}

export default App;
