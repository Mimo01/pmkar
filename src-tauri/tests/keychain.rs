use pmkar_lib::keychain::{delete_credential, get_credential, store_credential};

// Tests use a unique service name to avoid polluting real credentials
const TEST_TYPE: &str = "test-integration";
const TEST_USER: &str = "test-user-keychain";

// In debug mode the file-based backend is always available.
// In release mode we probe the OS keychain.
#[cfg(not(debug_assertions))]
fn keychain_available() -> bool {
    store_credential(TEST_TYPE, "probe", "probe")
        .and_then(|()| delete_credential(TEST_TYPE, "probe"))
        .is_ok()
}

#[test]
fn test_keychain_store_and_retrieve() {
    #[cfg(not(debug_assertions))]
    if !keychain_available() {
        eprintln!("Skipping: no keyring daemon available");
        return;
    }

    let secret = "test-pat-value-12345";
    store_credential(TEST_TYPE, TEST_USER, secret).unwrap();
    let retrieved = get_credential(TEST_TYPE, TEST_USER).unwrap();
    assert_eq!(retrieved, secret);
    // Cleanup
    delete_credential(TEST_TYPE, TEST_USER).ok();
}

#[test]
fn test_keychain_delete() {
    #[cfg(not(debug_assertions))]
    if !keychain_available() {
        eprintln!("Skipping: no keyring daemon available");
        return;
    }

    store_credential(TEST_TYPE, "del-user", "to-delete").unwrap();
    delete_credential(TEST_TYPE, "del-user").unwrap();
    let result = get_credential(TEST_TYPE, "del-user");
    assert!(result.is_err());
}

#[test]
fn test_keychain_get_nonexistent() {
    let result = get_credential(TEST_TYPE, "nonexistent-user-xyz");
    assert!(result.is_err());
}

/// Verifies that in debug mode credentials are actually written to disk as JSON.
#[cfg(debug_assertions)]
#[test]
fn test_dev_credential_file_persistence() {
    use std::collections::HashMap;

    let secret = "file-persistence-test-secret";
    let user = "file-persist-user";

    store_credential(TEST_TYPE, user, secret).unwrap();

    // Read the file directly and confirm the key is present
    let home = dirs::home_dir().expect("home dir must exist");
    let path = home.join(".pmkar-dev-credentials.json");
    assert!(path.exists(), "dev credential file should exist");

    let raw = std::fs::read_to_string(&path).expect("should read credential file");
    let map: HashMap<String, String> =
        serde_json::from_str(&raw).expect("should parse credential file");

    let expected_key = format!("pmkar-{TEST_TYPE}:{user}");
    assert_eq!(
        map.get(&expected_key).map(String::as_str),
        Some(secret),
        "credential should be stored under key {expected_key}"
    );

    // Cleanup
    delete_credential(TEST_TYPE, user).ok();
}
