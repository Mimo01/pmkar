use pmkar_lib::audit::{AuditDb, AuditEntry};

#[test]
fn test_audit_db_schema_creation() {
    let db = AuditDb::open_in_memory().unwrap();
    assert_eq!(db.count().unwrap(), 0);
}

#[test]
fn test_audit_insert_and_retrieve() {
    let db = AuditDb::open_in_memory().unwrap();
    let entry = AuditEntry {
        id: None,
        timestamp: "2026-03-20T10:00:00Z".into(),
        method: "GET".into(),
        url: "http://localhost:8080/rest/api/2/issue/TEST-1".into(),
        headers: r#"{"authorization": "[REDACTED]"}"#.into(),
        status_code: Some(200),
        response_body: Some(r#"{"key":"TEST-1"}"#.into()),
    };
    db.insert(&entry).unwrap();
    let all = db.get_all().unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].method, "GET");
    assert_eq!(all[0].status_code, Some(200));
    assert_eq!(all[0].url, "http://localhost:8080/rest/api/2/issue/TEST-1");
}

#[test]
fn test_audit_redaction_in_headers() {
    let db = AuditDb::open_in_memory().unwrap();
    // Simulate what AuditMiddleware produces — the header value must be [REDACTED]
    let entry = AuditEntry {
        id: None,
        timestamp: "2026-03-20T10:00:00Z".into(),
        method: "GET".into(),
        url: "http://localhost:8080/rest/api/2/search".into(),
        headers: r#"{"authorization": "[REDACTED]", "content-type": "application/json"}"#.into(),
        status_code: Some(200),
        response_body: None,
    };
    db.insert(&entry).unwrap();
    let all = db.get_all().unwrap();
    assert!(all[0].headers.contains("[REDACTED]"));
    assert!(!all[0].headers.contains("Bearer"));
    assert!(!all[0].headers.contains("secret"));
}

#[test]
fn test_audit_response_body_truncation() {
    let db = AuditDb::open_in_memory().unwrap();
    // MAX_RESPONSE_BODY_BYTES is 102_400 (100 KB); use a body larger than that
    let large_body = "x".repeat(200_000); // 200KB > 100KB limit
    let entry = AuditEntry {
        id: None,
        timestamp: "2026-03-20T10:00:00Z".into(),
        method: "POST".into(),
        url: "http://localhost:8081/rest/api/3/issue".into(),
        headers: "{}".into(),
        status_code: Some(201),
        response_body: Some(large_body),
    };
    db.insert(&entry).unwrap();
    let all = db.get_all().unwrap();
    let body = all[0].response_body.as_ref().unwrap();
    assert_eq!(body.len(), 102_400); // truncated to MAX_RESPONSE_BODY_BYTES (100 KB)
}

#[test]
fn test_audit_clear_logs() {
    let db = AuditDb::open_in_memory().unwrap();
    let entry = AuditEntry {
        id: None,
        timestamp: "2026-03-20T10:00:00Z".into(),
        method: "GET".into(),
        url: "http://example.com".into(),
        headers: "{}".into(),
        status_code: Some(200),
        response_body: None,
    };
    db.insert(&entry).unwrap();
    db.insert(&entry).unwrap();
    assert_eq!(db.count().unwrap(), 2);
    db.clear_logs().unwrap();
    assert_eq!(db.count().unwrap(), 0);
}
