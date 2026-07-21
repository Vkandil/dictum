use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use anyhow::{Context, Result};
use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};

use crate::store::{Store, SyncPayload, SyncSettings};

#[derive(Serialize, Deserialize)]
struct Envelope {
    version: u8,
    salt: String,
    nonce: String,
    ciphertext: String,
}

pub async fn push(
    store: &Store,
    settings: &SyncSettings,
    passphrase: &str,
    auth_password: Option<&str>,
) -> Result<()> {
    validate(settings, passphrase)?;
    let body = encrypt(&store.export_sync()?, passphrase)?;
    let response = authorize(
        reqwest::Client::new().put(&settings.endpoint),
        settings,
        auth_password,
    )
    .header("Content-Type", "application/vnd.dictum.encrypted+json")
    .body(body)
    .send()
    .await?;
    anyhow::ensure!(
        response.status().is_success(),
        "sync upload returned HTTP {}",
        response.status()
    );
    Ok(())
}

pub async fn pull(
    store: &Store,
    settings: &SyncSettings,
    passphrase: &str,
    auth_password: Option<&str>,
) -> Result<()> {
    validate(settings, passphrase)?;
    let response = authorize(
        reqwest::Client::new().get(&settings.endpoint),
        settings,
        auth_password,
    )
    .send()
    .await?;
    anyhow::ensure!(
        response.status().is_success(),
        "sync download returned HTTP {}",
        response.status()
    );
    let payload = decrypt(&response.bytes().await?, passphrase)?;
    store.import_sync(&payload)
}

fn authorize(
    request: reqwest::RequestBuilder,
    settings: &SyncSettings,
    auth_password: Option<&str>,
) -> reqwest::RequestBuilder {
    if settings.username.is_empty() {
        request
    } else {
        // The encryption passphrase never leaves the device: server login uses a
        // separate, optional credential so a compromised endpoint cannot derive
        // the key that decrypts the payload.
        request.basic_auth(&settings.username, auth_password)
    }
}

fn validate(settings: &SyncSettings, passphrase: &str) -> Result<()> {
    anyhow::ensure!(settings.enabled, "sync is disabled");
    let url = url::Url::parse(&settings.endpoint).context("invalid sync URL")?;
    anyhow::ensure!(
        matches!(url.scheme(), "https" | "http")
            && (!url.scheme().eq("http")
                || matches!(url.host_str(), Some("localhost" | "127.0.0.1"))),
        "sync requires HTTPS except on localhost"
    );
    anyhow::ensure!(
        passphrase.len() >= 10,
        "sync passphrase must contain at least 10 characters"
    );
    Ok(())
}

fn encrypt(payload: &SyncPayload, password: &str) -> Result<Vec<u8>> {
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)?;
    let ciphertext = cipher
        .encrypt(
            Nonce::from_slice(&nonce),
            serde_json::to_vec(payload)?.as_ref(),
        )
        .map_err(|_| anyhow::anyhow!("sync encryption failed"))?;
    Ok(serde_json::to_vec(&Envelope {
        version: 1,
        salt: STANDARD.encode(salt),
        nonce: STANDARD.encode(nonce),
        ciphertext: STANDARD.encode(ciphertext),
    })?)
}

fn decrypt(bytes: &[u8], password: &str) -> Result<SyncPayload> {
    let envelope: Envelope =
        serde_json::from_slice(bytes).context("invalid encrypted sync document")?;
    anyhow::ensure!(envelope.version == 1, "unsupported sync format");
    let salt = STANDARD.decode(envelope.salt)?;
    let nonce = STANDARD.decode(envelope.nonce)?;
    let ciphertext = STANDARD.decode(envelope.ciphertext)?;
    anyhow::ensure!(nonce.len() == 12, "invalid sync nonce");
    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key)?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| anyhow::anyhow!("wrong passphrase or corrupted sync data"))?;
    Ok(serde_json::from_slice(&plaintext)?)
}

fn derive_key(password: &str, salt: &[u8]) -> Result<[u8; 32]> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    Ok(key)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::AppSettings;
    #[test]
    fn encrypted_payload_round_trip() {
        let value = SyncPayload {
            settings: AppSettings::default(),
            dictionary: vec![],
            snippets: vec![],
            exported_at: 1,
        };
        let bytes = encrypt(&value, "a long secret").unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("openrouter"));
        assert_eq!(decrypt(&bytes, "a long secret").unwrap().exported_at, 1);
    }
}
