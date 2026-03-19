use pmkar_lib::keychain::{delete_credential, get_credential, store_credential};

// Tests use a unique service name to avoid polluting real keychain
const TEST_TYPE: &str = "test-integration";
const TEST_USER: &str = "test-user-keychain";

#[test]
fn test_keychain_store_and_retrieve() {
    let secret = "test-pat-value-12345";
    store_credential(TEST_TYPE, TEST_USER, secret).unwrap();
    let retrieved = get_credential(TEST_TYPE, TEST_USER).unwrap();
    assert_eq!(retrieved, secret);
    // Cleanup
    delete_credential(TEST_TYPE, TEST_USER).ok();
}

#[test]
fn test_keychain_delete() {
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
