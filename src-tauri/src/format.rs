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

/// Split text into `(start_byte, end_byte, lowercased)` runs of alphanumeric characters.
/// Everything else (spaces, punctuation) is treated as a separator, so matching is naturally
/// tolerant of the punctuation and casing that speech-to-text adds around a spoken phrase.
fn word_tokens(text: &str) -> Vec<(usize, usize, String)> {
    let mut tokens = Vec::new();
    let mut start: Option<usize> = None;
    for (index, ch) in text.char_indices() {
        if ch.is_alphanumeric() {
            if start.is_none() {
                start = Some(index);
            }
        } else if let Some(begin) = start.take() {
            tokens.push((begin, index, text[begin..index].to_lowercase()));
        }
    }
    if let Some(begin) = start {
        tokens.push((begin, text.len(), text[begin..].to_lowercase()));
    }
    tokens
}

/// Expand voice snippets inline: every occurrence of a trigger phrase anywhere in the
/// transcript is replaced by its expansion, matching whole words case-insensitively and
/// ignoring surrounding punctuation. Returns the rewritten text and whether any snippet fired
/// (callers use this to optionally insert the expansion verbatim, bypassing AI formatting).
pub fn expand_snippets(raw: &str, snippets: &[(String, String)]) -> (String, bool) {
    let mut text = raw.to_string();
    let mut fired = false;
    for (trigger, expansion) in snippets {
        let trigger_tokens: Vec<String> = word_tokens(trigger).into_iter().map(|t| t.2).collect();
        if trigger_tokens.is_empty() {
            continue;
        }
        // Only search past the last insertion so a trigger appearing inside its own expansion
        // can never cause an infinite loop.
        let mut min_offset = 0usize;
        loop {
            let tokens = word_tokens(&text);
            let mut matched: Option<(usize, usize)> = None;
            for window in 0..tokens.len() {
                if tokens[window].0 < min_offset {
                    continue;
                }
                if window + trigger_tokens.len() > tokens.len() {
                    break;
                }
                if (0..trigger_tokens.len()).all(|k| tokens[window + k].2 == trigger_tokens[k]) {
                    matched = Some((
                        tokens[window].0,
                        tokens[window + trigger_tokens.len() - 1].1,
                    ));
                    break;
                }
            }
            let Some((start, end)) = matched else { break };
            text.replace_range(start..end, expansion);
            fired = true;
            min_offset = start + expansion.len();
        }
    }
    (text, fired)
}

pub fn assistant_query(raw: &str) -> &str {
    let trimmed = raw.trim();
    let lower = trimmed.to_ascii_lowercase();
    let without_prefix = if lower.starts_with("ask dictum") {
        &trimmed["ask dictum".len()..]
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
    fn snippet_matches_whole_utterance_ignoring_punctuation_and_case() {
        let snippets = [("my email".into(), "me@example.com".into())];
        let (text, fired) = expand_snippets("My email.", &snippets);
        assert_eq!(text, "me@example.com.");
        assert!(fired);
    }

    #[test]
    fn snippet_expands_inline_within_a_sentence() {
        let snippets = [("mon email".into(), "kandil.victor@gmail.com".into())];
        let (text, fired) = expand_snippets("écris à mon email", &snippets);
        assert_eq!(text, "écris à kandil.victor@gmail.com");
        assert!(fired);
    }

    #[test]
    fn snippet_replaces_every_occurrence() {
        let snippets = [("sig".into(), "Kandil".into())];
        let (text, _) = expand_snippets("sig and again sig", &snippets);
        assert_eq!(text, "Kandil and again Kandil");
    }

    #[test]
    fn snippet_only_matches_whole_words() {
        let snippets = [("cat".into(), "DOG".into())];
        let (text, fired) = expand_snippets("the category", &snippets);
        assert_eq!(text, "the category");
        assert!(!fired);
    }

    #[test]
    fn snippet_expansion_containing_trigger_does_not_loop() {
        let snippets = [("email".into(), "my email address".into())];
        let (text, fired) = expand_snippets("send email", &snippets);
        assert_eq!(text, "send my email address");
        assert!(fired);
    }

    #[test]
    fn no_snippet_leaves_text_untouched() {
        let (text, fired) = expand_snippets("hello world", &[]);
        assert_eq!(text, "hello world");
        assert!(!fired);
    }
    #[test]
    fn assistant_prefix_is_not_sent_as_part_of_the_question() {
        assert_eq!(
            assistant_query("Ask Dictum: what is Rust?"),
            "what is Rust?"
        );
        assert_eq!(
            assistant_query("answer why the sky is blue"),
            "why the sky is blue"
        );
    }
}
