//! Helpers to spawn external processes without flashing a console window on Windows.

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Build a `std::process::Command` for the given program, hiding the console window on Windows.
pub fn hidden_command(program: &str) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Build a `tokio::process::Command` for the given program, hiding the console window on Windows.
pub fn hidden_tokio_command(program: &str) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(program);
    #[cfg(windows)]
    {
        // tokio re-exports CommandExt via its own trait, no explicit import needed
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
