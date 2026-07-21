use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use directories::ProjectDirs;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeySettings {
    pub mode: String,
    pub combo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormattingSettings {
    pub enabled: bool,
    pub model: String,
    pub remove_fillers: bool,
    pub fix_grammar: bool,
    pub tone: String,
    pub fast_insert: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySettings {
    pub enabled: bool,
    pub retention_days: u32,
    pub store_audio: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RealtimeSettings {
    pub enabled: bool,
    pub provider: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSettings {
    pub enabled: bool,
    pub endpoint: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub onboarding_complete: bool,
    pub provider: String,
    pub model: String,
    pub local_endpoint: String,
    pub hotkey: HotkeySettings,
    pub command_hotkey: String,
    pub language: String,
    pub microphone_id: Option<String>,
    pub injection: String,
    pub formatting: FormattingSettings,
    pub whisper_mode: bool,
    pub history: HistorySettings,
    pub autostart: bool,
    pub zero_retention: bool,
    pub fallback_provider: Option<String>,
    pub realtime: RealtimeSettings,
    pub sync: SyncSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            onboarding_complete: false,
            provider: "openrouter".into(),
            model: "mistralai/voxtral-mini-transcribe".into(),
            local_endpoint: "http://localhost:8000/v1".into(),
            hotkey: HotkeySettings {
                mode: "hold".into(),
                combo: "CommandOrControl+Shift+Space".into(),
            },
            command_hotkey: "CommandOrControl+Shift+Period".into(),
            language: "auto".into(),
            microphone_id: None,
            injection: "clipboard".into(),
            formatting: FormattingSettings {
                enabled: true,
                model: "mistralai/ministral-8b".into(),
                remove_fillers: true,
                fix_grammar: true,
                tone: "auto".into(),
                fast_insert: false,
            },
            whisper_mode: false,
            history: HistorySettings {
                enabled: true,
                retention_days: 30,
                store_audio: false,
            },
            autostart: false,
            zero_retention: true,
            fallback_provider: None,
            realtime: RealtimeSettings {
                enabled: false,
                provider: "mistral".into(),
                model: "voxtral-mini-transcribe-realtime-2602".into(),
            },
            sync: SyncSettings {
                enabled: false,
                endpoint: String::new(),
                username: String::new(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryTerm {
    pub id: i64,
    pub term: String,
    pub created_at: i64,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: i64,
    pub trigger: String,
    pub expansion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: i64,
    pub text: String,
    pub raw_text: Option<String>,
    pub app_bundle: Option<String>,
    pub audio_ms: i64,
    pub cost_usd: f64,
    pub model: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderManifest {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub transcription_path: String,
    pub chat_path: String,
    pub models: Vec<String>,
    pub supports_realtime: bool,
    pub requires_api_key: bool,
}

pub fn builtin_providers() -> Vec<ProviderManifest> {
    vec![
        ProviderManifest {
            id: "openrouter".into(),
            name: "OpenRouter".into(),
            base_url: "https://openrouter.ai/api/v1".into(),
            transcription_path: "/audio/transcriptions".into(),
            chat_path: "/chat/completions".into(),
            models: vec![
                "mistralai/voxtral-mini-transcribe".into(),
                "mistralai/voxtral-small-24b-2507".into(),
            ],
            supports_realtime: false,
            requires_api_key: true,
        },
        ProviderManifest {
            id: "mistral".into(),
            name: "Mistral".into(),
            base_url: "https://api.mistral.ai/v1".into(),
            transcription_path: "/audio/transcriptions".into(),
            chat_path: "/chat/completions".into(),
            models: vec![
                "voxtral-mini-latest".into(),
                "voxtral-mini-transcribe-realtime-2602".into(),
            ],
            supports_realtime: true,
            requires_api_key: true,
        },
        ProviderManifest {
            id: "local".into(),
            name: "Local / vLLM".into(),
            base_url: "http://localhost:8000/v1".into(),
            transcription_path: "/audio/transcriptions".into(),
            chat_path: "/chat/completions".into(),
            models: vec!["mistralai/Voxtral-Mini-3B-2507".into()],
            supports_realtime: true,
            requires_api_key: false,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPayload {
    pub settings: AppSettings,
    pub dictionary: Vec<DictionaryTerm>,
    pub snippets: Vec<Snippet>,
    pub exported_at: i64,
}

#[derive(Clone)]
pub struct Store {
    path: PathBuf,
    config_path: PathBuf,
    provider_dir: PathBuf,
}

impl Store {
    pub fn new() -> Result<Self> {
        if let Some(directory) = std::env::var_os("DICTUM_DATA_DIR").map(PathBuf::from) {
            return Self::from_directories(&directory, &directory);
        }
        let dirs = ProjectDirs::from("com", "dictum", "Dictum")
            .context("could not resolve the application data directory")?;
        Self::from_directories(dirs.data_local_dir(), dirs.config_dir())
    }

    fn from_directories(data_directory: &Path, config_directory: &Path) -> Result<Self> {
        fs::create_dir_all(data_directory)?;
        fs::create_dir_all(config_directory)?;
        let provider_dir = config_directory.join("providers");
        fs::create_dir_all(&provider_dir)?;
        let store = Self {
            path: data_directory.join("dictum.sqlite3"),
            config_path: config_directory.join("config.json"),
            provider_dir,
        };
        store.migrate()?;
        Ok(store)
    }

    #[cfg(test)]
    fn in_directory(directory: &Path) -> Result<Self> {
        Self::from_directories(directory, directory)
    }

    fn connection(&self) -> Result<Connection> {
        let connection = Connection::open(&self.path)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        Ok(connection)
    }

    fn migrate(&self) -> Result<()> {
        self.connection()?.execute_batch(
            "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS dictionary (id INTEGER PRIMARY KEY, term TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at INTEGER NOT NULL, source TEXT NOT NULL DEFAULT 'manual');
             CREATE TABLE IF NOT EXISTS snippets (id INTEGER PRIMARY KEY, trigger TEXT NOT NULL UNIQUE COLLATE NOCASE, expansion TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, text TEXT NOT NULL, raw_text TEXT, app_bundle TEXT, audio_ms INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, model TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
             CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);"
        )?;
        Ok(())
    }

    pub fn settings(&self) -> Result<AppSettings> {
        let connection = self.connection()?;
        let raw: Option<String> = connection
            .query_row("SELECT value FROM settings WHERE key='app'", [], |row| {
                row.get(0)
            })
            .optional()?;
        if let Some(raw) = raw {
            Ok(serde_json::from_str(&raw).unwrap_or_default())
        } else if self.config_path.exists() {
            Ok(serde_json::from_slice(&fs::read(&self.config_path)?).unwrap_or_default())
        } else {
            Ok(AppSettings::default())
        }
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<()> {
        self.validate_settings(settings)?;
        let raw = serde_json::to_string_pretty(settings)?;
        self.connection()?.execute("INSERT INTO settings(key,value) VALUES('app',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [&raw])?;
        fs::write(&self.config_path, raw)?;
        Ok(())
    }

    pub fn dictionary(&self) -> Result<Vec<DictionaryTerm>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id,term,created_at,source FROM dictionary ORDER BY term COLLATE NOCASE",
        )?;
        let items = statement
            .query_map([], |row| {
                Ok(DictionaryTerm {
                    id: row.get(0)?,
                    term: row.get(1)?,
                    created_at: row.get(2)?,
                    source: row.get(3)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(items)
    }

    pub fn add_dictionary(&self, term: &str, source: &str) -> Result<()> {
        self.connection()?.execute("INSERT INTO dictionary(term,created_at,source) VALUES(?1,unixepoch(),?2) ON CONFLICT(term) DO NOTHING", params![term, source])?;
        Ok(())
    }
    pub fn remove_dictionary(&self, id: i64) -> Result<()> {
        self.connection()?
            .execute("DELETE FROM dictionary WHERE id=?1", [id])?;
        Ok(())
    }

    pub fn snippets(&self) -> Result<Vec<Snippet>> {
        let connection = self.connection()?;
        let mut statement = connection
            .prepare("SELECT id,trigger,expansion FROM snippets ORDER BY trigger COLLATE NOCASE")?;
        let items = statement
            .query_map([], |row| {
                Ok(Snippet {
                    id: row.get(0)?,
                    trigger: row.get(1)?,
                    expansion: row.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(items)
    }
    pub fn save_snippet(&self, id: Option<i64>, trigger: &str, expansion: &str) -> Result<()> {
        match id { Some(id) => self.connection()?.execute("UPDATE snippets SET trigger=?1, expansion=?2 WHERE id=?3", params![trigger, expansion, id])?, None => self.connection()?.execute("INSERT INTO snippets(trigger,expansion) VALUES(?1,?2) ON CONFLICT(trigger) DO UPDATE SET expansion=excluded.expansion", params![trigger, expansion])? };
        Ok(())
    }
    pub fn remove_snippet(&self, id: i64) -> Result<()> {
        self.connection()?
            .execute("DELETE FROM snippets WHERE id=?1", [id])?;
        Ok(())
    }

    pub fn insert_history(
        &self,
        text: &str,
        raw_text: &str,
        app: Option<&str>,
        audio_ms: i64,
        cost: f64,
        model: &str,
    ) -> Result<()> {
        self.connection()?.execute("INSERT INTO history(text,raw_text,app_bundle,audio_ms,cost_usd,model,created_at) VALUES(?1,?2,?3,?4,?5,?6,unixepoch())", params![text, raw_text, app, audio_ms, cost, model])?;
        Ok(())
    }
    pub fn history(&self, search: &str) -> Result<Vec<HistoryItem>> {
        let connection = self.connection()?;
        let pattern = format!("%{}%", search);
        let mut statement = connection.prepare("SELECT id,text,raw_text,app_bundle,audio_ms,cost_usd,model,created_at FROM history WHERE text LIKE ?1 ORDER BY created_at DESC LIMIT 1000")?;
        let items = statement
            .query_map([pattern], |row| {
                Ok(HistoryItem {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    raw_text: row.get(2)?,
                    app_bundle: row.get(3)?,
                    audio_ms: row.get(4)?,
                    cost_usd: row.get(5)?,
                    model: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;
        Ok(items)
    }
    pub fn delete_history(&self, id: Option<i64>) -> Result<()> {
        if let Some(id) = id {
            self.connection()?
                .execute("DELETE FROM history WHERE id=?1", [id])?;
        } else {
            self.connection()?.execute("DELETE FROM history", [])?;
        }
        Ok(())
    }
    pub fn purge_history(&self, days: u32) -> Result<()> {
        self.connection()?.execute(
            "DELETE FROM history WHERE created_at < unixepoch() - (?1 * 86400)",
            [days],
        )?;
        Ok(())
    }

    pub fn save_provider(&self, manifest: &ProviderManifest) -> Result<()> {
        validate_manifest(manifest)?;
        anyhow::ensure!(
            !builtin_providers()
                .iter()
                .any(|provider| provider.id == manifest.id),
            "built-in provider identifiers are reserved"
        );
        fs::write(
            self.provider_dir.join(format!("{}.json", manifest.id)),
            serde_json::to_vec_pretty(manifest)?,
        )?;
        Ok(())
    }
    pub fn providers(&self) -> Result<Vec<ProviderManifest>> {
        let mut providers = builtin_providers();
        for entry in fs::read_dir(&self.provider_dir)? {
            let path = entry?.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(manifest) = serde_json::from_slice::<ProviderManifest>(&fs::read(path)?) {
                    if validate_manifest(&manifest).is_ok()
                        && !providers.iter().any(|provider| provider.id == manifest.id)
                    {
                        providers.push(manifest);
                    }
                }
            }
        }
        Ok(providers)
    }
    pub fn provider(&self, id: &str) -> Result<ProviderManifest> {
        self.providers()?
            .into_iter()
            .find(|p| p.id == id)
            .context("unknown provider")
    }
    pub fn export_sync(&self) -> Result<SyncPayload> {
        Ok(SyncPayload {
            settings: self.settings()?,
            dictionary: self.dictionary()?,
            snippets: self.snippets()?,
            exported_at: chrono::Utc::now().timestamp(),
        })
    }
    pub fn import_sync(&self, payload: &SyncPayload) -> Result<()> {
        self.save_settings(&payload.settings)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        transaction.execute("DELETE FROM dictionary", [])?;
        transaction.execute("DELETE FROM snippets", [])?;
        for item in &payload.dictionary {
            transaction.execute(
                "INSERT INTO dictionary(term,created_at,source) VALUES(?1,?2,?3)",
                params![item.term, item.created_at, item.source],
            )?;
        }
        for item in &payload.snippets {
            transaction.execute(
                "INSERT INTO snippets(trigger,expansion) VALUES(?1,?2)",
                params![item.trigger, item.expansion],
            )?;
        }
        transaction.commit()?;
        Ok(())
    }
    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn validate_settings(&self, settings: &AppSettings) -> Result<()> {
        anyhow::ensure!(
            matches!(
                settings.hotkey.mode.as_str(),
                "hold" | "toggle" | "doubleTap"
            ),
            "invalid shortcut mode"
        );
        anyhow::ensure!(
            matches!(settings.injection.as_str(), "clipboard" | "keystroke"),
            "invalid injection mode"
        );
        anyhow::ensure!(!settings.model.trim().is_empty(), "model is required");
        anyhow::ensure!(
            !settings.model.to_ascii_lowercase().contains("tts"),
            "text-to-speech models cannot transcribe audio"
        );
        anyhow::ensure!(
            !settings.history.store_audio,
            "audio persistence is not supported"
        );
        anyhow::ensure!(
            settings.history.retention_days > 0,
            "history retention must be positive"
        );
        let provider = self.provider(&settings.provider)?;
        if let Some(fallback) = &settings.fallback_provider {
            anyhow::ensure!(
                fallback != &settings.provider,
                "fallback must differ from primary provider"
            );
            self.provider(fallback)?;
        }
        if settings.realtime.enabled {
            let realtime = self.provider(&settings.realtime.provider)?;
            anyhow::ensure!(
                realtime.supports_realtime,
                "selected provider does not support realtime"
            );
            anyhow::ensure!(
                !settings.realtime.model.trim().is_empty(),
                "realtime model is required"
            );
        }
        if provider.id == "local" || settings.realtime.provider == "local" {
            let url =
                url::Url::parse(&settings.local_endpoint).context("invalid local endpoint")?;
            anyhow::ensure!(
                matches!(url.scheme(), "http" | "https"),
                "local endpoint must use HTTP(S)"
            );
        }
        Ok(())
    }
}

fn validate_manifest(manifest: &ProviderManifest) -> Result<()> {
    anyhow::ensure!(
        !manifest.id.is_empty()
            && manifest
                .id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
        "invalid provider id"
    );
    let url = url::Url::parse(&manifest.base_url)?;
    anyhow::ensure!(
        matches!(url.scheme(), "http" | "https"),
        "provider URL must use HTTP(S)"
    );
    anyhow::ensure!(
        !manifest.models.is_empty(),
        "provider must advertise at least one model"
    );
    anyhow::ensure!(
        !manifest.name.trim().is_empty(),
        "provider name is required"
    );
    anyhow::ensure!(
        manifest.models.iter().all(|model| !model.trim().is_empty()),
        "provider models cannot be empty"
    );
    for path in [&manifest.transcription_path, &manifest.chat_path] {
        anyhow::ensure!(
            path.starts_with('/') && !path.contains("..") && !path.contains("://"),
            "provider paths must be absolute URL paths"
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_store() -> (Store, PathBuf) {
        let directory =
            std::env::temp_dir().join(format!("dictum-store-test-{}", uuid::Uuid::new_v4()));
        (Store::in_directory(&directory).unwrap(), directory)
    }

    #[test]
    fn defaults_are_private() {
        let s = AppSettings::default();
        assert!(!s.history.store_audio);
        assert!(s.zero_retention);
    }
    #[test]
    fn provider_ids_are_restricted() {
        let mut p = builtin_providers().remove(0);
        p.id = "../bad".into();
        assert!(validate_manifest(&p).is_err());
    }
    #[test]
    fn rejects_tts_audio_storage_and_builtin_provider_overrides() {
        let (store, directory) = test_store();
        let tts = AppSettings {
            model: "mistralai/voxtral-mini-tts-2603".into(),
            ..AppSettings::default()
        };
        assert!(store.save_settings(&tts).is_err());
        let audio = AppSettings {
            history: HistorySettings {
                store_audio: true,
                ..AppSettings::default().history
            },
            ..AppSettings::default()
        };
        assert!(store.save_settings(&audio).is_err());
        assert!(store.save_provider(&builtin_providers()[0]).is_err());
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn settings_dictionary_snippets_and_history_round_trip_privately() {
        let (store, directory) = test_store();
        let settings = AppSettings {
            language: "fr".into(),
            ..AppSettings::default()
        };
        store.save_settings(&settings).unwrap();
        assert_eq!(store.settings().unwrap().language, "fr");

        let config = fs::read_to_string(directory.join("config.json")).unwrap();
        assert!(!config.to_lowercase().contains("api_key"));
        assert!(!config.to_lowercase().contains("apikey"));

        store.add_dictionary("Voxtral", "manual").unwrap();
        assert_eq!(store.dictionary().unwrap()[0].term, "Voxtral");
        store
            .save_snippet(None, "my email", "me@example.com")
            .unwrap();
        assert_eq!(store.snippets().unwrap()[0].expansion, "me@example.com");
        store
            .insert_history("Hello", "hello", Some("Notion"), 900, 0.000_1, "mini")
            .unwrap();
        assert_eq!(
            store.history("Hell").unwrap()[0].app_bundle.as_deref(),
            Some("Notion")
        );

        let columns: Vec<String> = {
            let connection = store.connection().unwrap();
            let mut statement = connection.prepare("PRAGMA table_info(history)").unwrap();
            statement
                .query_map([], |row| row.get(1))
                .unwrap()
                .collect::<rusqlite::Result<_>>()
                .unwrap()
        };
        assert!(!columns
            .iter()
            .any(|column| column.contains("audio") && column != "audio_ms"));

        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn retention_purge_removes_only_expired_history() {
        let (store, directory) = test_store();
        store
            .insert_history("new", "new", None, 1, 0.0, "mini")
            .unwrap();
        store
            .insert_history("old", "old", None, 1, 0.0, "mini")
            .unwrap();
        store
            .connection()
            .unwrap()
            .execute(
                "UPDATE history SET created_at = unixepoch() - (40 * 86400) WHERE text='old'",
                [],
            )
            .unwrap();
        store.purge_history(30).unwrap();
        let remaining = store.history("").unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].text, "new");
        fs::remove_dir_all(directory).unwrap();
    }
}
