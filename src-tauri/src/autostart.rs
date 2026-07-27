//! Launch-at-login through the Windows `Run` key.
//!
//! This replaces `tauri-plugin-autostart`, which writes the executable path unquoted. Any user
//! whose profile contains a space - `C:\Users\Kandil Victor\...` - then gets an entry Windows
//! parses as the program `C:\Users\Kandil` with the rest as arguments. The app never starts,
//! and Windows shows a "How do you want to open this file?" prompt at every login instead.

use anyhow::{Context, Result};
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE};
use winreg::RegKey;

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
/// Same value name the previous plugin used, so enabling simply overwrites the broken entry.
const VALUE_NAME: &str = "Dictum";
/// Started minimised to the tray at login rather than popping the window in the user's face.
const HIDDEN_FLAG: &str = "--hidden";

/// The command Windows should run at login, with the path quoted so spaces survive.
fn launch_command() -> Result<String> {
    let exe = std::env::current_exe().context("could not resolve the Dictum executable path")?;
    Ok(format!("\"{}\" {HIDDEN_FLAG}", exe.display()))
}

pub fn enable() -> Result<()> {
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(RUN_KEY)
        .context("could not open the Windows startup registry key")?;
    key.set_value(VALUE_NAME, &launch_command()?)
        .context("could not register Dictum to launch at login")
}

pub fn disable() -> Result<()> {
    let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(RUN_KEY, KEY_WRITE)
    else {
        return Ok(());
    };
    match key.delete_value(VALUE_NAME) {
        Ok(()) => Ok(()),
        // Already absent is the state we wanted anyway.
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).context("could not remove Dictum from launch at login"),
    }
}

/// True only when the entry exists *and* points at this executable with the expected flag.
/// A stale path from a previous install location reports false so it gets rewritten.
pub fn is_enabled() -> bool {
    let Ok(expected) = launch_command() else {
        return false;
    };
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY, KEY_READ)
        .and_then(|key| key.get_value::<String, _>(VALUE_NAME))
        .map(|current| current.eq_ignore_ascii_case(&expected))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_launch_command_quotes_paths_so_spaces_survive() {
        let command = launch_command().unwrap();
        assert!(command.starts_with('"'), "path must be quoted: {command}");
        assert!(command.ends_with(&format!("\" {HIDDEN_FLAG}")), "{command}");
        // Everything between the quotes is the executable, spaces included.
        let closing = command.rfind('"').unwrap();
        assert!(command[1..closing].ends_with(".exe"), "{command}");
    }
}
