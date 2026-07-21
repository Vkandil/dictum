use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct FocusedApp {
    pub name: String,
    pub context: String,
}

pub fn current() -> FocusedApp {
    let name = platform_title().unwrap_or_else(|| "Unknown application".into());
    let lower = name.to_lowercase();
    let context = if ["code", "terminal", "studio", "intellij", "zed", "sublime"]
        .iter()
        .any(|v| lower.contains(v))
    {
        "code"
    } else if ["slack", "discord", "teams", "whatsapp", "messages"]
        .iter()
        .any(|v| lower.contains(v))
    {
        "chat"
    } else if ["mail", "gmail", "outlook", "notion", "word", "docs"]
        .iter()
        .any(|v| lower.contains(v))
    {
        "formal writing"
    } else {
        "general writing"
    };
    FocusedApp {
        name,
        context: context.into(),
    }
}

fn platform_title() -> Option<String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
    };
    unsafe {
        let window = GetForegroundWindow();
        let length = GetWindowTextLengthW(window);
        if length == 0 {
            return None;
        }
        let mut buffer = vec![0u16; length as usize + 1];
        let copied = GetWindowTextW(window, &mut buffer);
        Some(String::from_utf16_lossy(&buffer[..copied as usize]))
    }
}
