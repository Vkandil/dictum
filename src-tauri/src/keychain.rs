use anyhow::{Context, Result};
use keyring::Entry;

const SERVICE: &str = "com.utter.app";

pub fn set(provider: &str, secret: &str) -> Result<()> {
    anyhow::ensure!(!secret.trim().is_empty(), "API key cannot be empty");
    Entry::new(SERVICE, provider)?
        .set_password(secret)
        .context("could not save the API key in the OS keychain")
}

pub fn get(provider: &str) -> Result<Option<String>> {
    match Entry::new(SERVICE, provider)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error).context("could not read the API key from the OS keychain"),
    }
}

pub fn delete(provider: &str) -> Result<()> {
    match Entry::new(SERVICE, provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.into()),
    }
}
