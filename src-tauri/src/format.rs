use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::Client;
use serde_json::json;

use crate::store::{FormattingSettings, ProviderManifest};

#[derive(Debug, Clone, Copy)]
pub enum FormatIntent<'a> {
    Dictation,
    Command {
        instruction: &'a str,
        previous: &'a str,
    },
    Assistant,
}

pub struct FormatProvider<'a> {
    pub manifest: &'a ProviderManifest,
    pub api_key: Option<&'a str>,
    pub zero_retention: bool,
}

pub async fn format_text(
    raw: &str,
    app_context: &str,
    dictionary: &[String],
    settings: &FormattingSettings,
    provider: FormatProvider<'_>,
    intent: FormatIntent<'_>,
) -> Result<String> {
    let system = build_system_prompt(app_context, dictionary, settings, intent);
    let user = match intent {
        FormatIntent::Dictation => raw.to_string(),
        FormatIntent::Command {
            instruction,
            previous,
        } => format!("TEXT TO TRANSFORM:\n{previous}\n\nVOICE INSTRUCTION:\n{instruction}"),
        FormatIntent::Assistant => raw.to_string(),
    };
    let mut body = json!({"model":settings.model,"messages":[{"role":"system","content":system},{"role":"user","content":user}],"temperature":0.1});
    if provider.zero_retention && provider.manifest.id == "openrouter" {
        body["provider"] = json!({"zdr":true,"data_collection":"deny"});
    }
    let url = format!(
        "{}{}",
        provider.manifest.base_url.trim_end_matches('/'),
        provider.manifest.chat_path
    );
    let client = Client::builder().timeout(Duration::from_secs(10)).build()?;
    let mut request = client.post(url).json(&body);
    if let Some(key) = provider.api_key {
        request = request.bearer_auth(key);
    }
    let response = request.send().await.context("formatting request failed")?;
    let status = response.status();
    let value: serde_json::Value = response
        .json()
        .await
        .context("invalid formatting response")?;
    anyhow::ensure!(
        status.is_success(),
        "formatting provider returned HTTP {}",
        status.as_u16()
    );
    let output = value
        .pointer("/choices/0/message/content")
        .and_then(|value| value.as_str())
        .context("formatting response had no text")?;
    Ok(clean_model_output(output))
}

pub fn build_system_prompt(
    app_context: &str,
    dictionary: &[String],
    settings: &FormattingSettings,
    intent: FormatIntent<'_>,
) -> String {
    let mut instructions = match intent {
        FormatIntent::Dictation => vec!["You are the invisible writing layer in a voice-dictation tool. Return only the final text; never explain your work. Preserve meaning and factual content.".to_string()],
        FormatIntent::Command { .. } => vec!["Apply the voice instruction to TEXT TO TRANSFORM. Return only the transformed text. Never mention the instruction.".to_string()],
        FormatIntent::Assistant => vec!["Answer the user's spoken question directly and concisely. Return only the answer to insert at their cursor.".to_string()],
    };
    if settings.remove_fillers {
        instructions.push(
            "Remove speech fillers and false starts while retaining intentional emphasis.".into(),
        );
    }
    if settings.fix_grammar {
        instructions.push("Correct grammar, punctuation, capitalization, and spoken self-corrections; the last correction wins.".into());
    }
    let tone = if settings.tone == "auto" {
        infer_tone(app_context)
    } else {
        settings.tone.as_str()
    };
    instructions.push(match tone {
        "code" => "This is a code editor or terminal: do not creatively rephrase. Preserve identifiers, filenames, symbols, indentation requests, and code syntax.".into(),
        "formal" => "Use a clear, professional tone suitable for email and documents.".into(),
        "casual" => "Use a natural, concise conversational tone suitable for chat.".into(),
        _ => "Match the speaker's tone.".into(),
    });
    if !dictionary.is_empty() {
        instructions.push(format!(
            "Preserve these user vocabulary terms exactly when phonetically relevant: {}.",
            dictionary.join(", ")
        ));
    }
    instructions.push(format!("Focused application context: {app_context}."));
    instructions.join("\n")
}

fn infer_tone(app: &str) -> &'static str {
    let app = app.to_lowercase();
    if [
        "code",
        "visual studio",
        "terminal",
        "iterm",
        "zed",
        "intellij",
        "sublime",
    ]
    .iter()
    .any(|needle| app.contains(needle))
    {
        "code"
    } else if ["slack", "discord", "teams", "messages", "whatsapp"]
        .iter()
        .any(|needle| app.contains(needle))
    {
        "casual"
    } else if ["mail", "gmail", "outlook", "notion", "word", "docs"]
        .iter()
        .any(|needle| app.contains(needle))
    {
        "formal"
    } else {
        "auto"
    }
}

fn clean_model_output(value: &str) -> String {
    let value = value.trim();
    if value.starts_with("```") && value.ends_with("```") {
        value
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim_start_matches(|c: char| c.is_ascii_alphabetic())
            .trim()
            .to_string()
    } else {
        value.trim_matches('"').trim().to_string()
    }
}

pub fn expand_snippets(raw: &str, snippets: &[(String, String)]) -> String {
    let normalized = raw.trim().trim_end_matches(['.', '!', '?']).to_lowercase();
    if let Some((_, expansion)) = snippets
        .iter()
        .find(|(trigger, _)| trigger.to_lowercase() == normalized)
    {
        return expansion.clone();
    }
    raw.to_string()
}

pub fn assistant_query(raw: &str) -> &str {
    let trimmed = raw.trim();
    let lower = trimmed.to_ascii_lowercase();
    let without_prefix = if lower.starts_with("ask utter") {
        &trimmed["ask utter".len()..]
    } else if lower.starts_with("answer ") {
        &trimmed["answer".len()..]
    } else {
        trimmed
    };
    without_prefix
        .trim_start_matches([' ', ':', ',', '-'])
        .trim()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::AppSettings;
    #[test]
    fn code_context_is_protected() {
        let prompt = build_system_prompt(
            "Visual Studio Code",
            &[],
            &AppSettings::default().formatting,
            FormatIntent::Dictation,
        );
        assert!(prompt.contains("identifiers"));
    }
    #[test]
    fn exact_snippet_ignores_terminal_punctuation() {
        assert_eq!(
            expand_snippets("my email.", &[("my email".into(), "me@example.com".into())]),
            "me@example.com"
        );
    }
    #[test]
    fn assistant_prefix_is_not_sent_as_part_of_the_question() {
        assert_eq!(assistant_query("Ask Utter: what is Rust?"), "what is Rust?");
        assert_eq!(
            assistant_query("answer why the sky is blue"),
            "why the sky is blue"
        );
    }
}
