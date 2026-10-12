mod common;

fn auth_header() -> &'static str {
    "Bearer test-token-any-value"
}

/// Test Bug createmeta paginates across 2 pages: total=10, page1=6 fields, page2=4 fields.
/// Together they yield 10 unique fieldIds.
/// Uses: startAt=0&maxResults=6 → 6 fields, startAt=6&maxResults=6 → 4 fields (partial last page).
#[tokio::test(flavor = "multi_thread")]
async fn test_bug_createmeta_paginates_two_pages() {
    let client = reqwest::Client::new();

    // Page 1: startAt=0&maxResults=6
    let resp1 = client
        .get(format!(
            "{}/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001?startAt=0&maxResults=6",
            common::v3_base()
        ))
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Page 1 request failed");
    assert_eq!(resp1.status().as_u16(), 200);
    let body1: serde_json::Value = resp1.json().await.expect("Page 1 invalid JSON");

    assert_eq!(
        body1["total"], 10,
        "Bug createmeta total should be 10 (Pitfall F pagination boundary)"
    );
    let page1_fields = body1["fields"]
        .as_array()
        .expect("page1 fields should be an array");
    assert_eq!(
        page1_fields.len(),
        6,
        "Page 1 should return exactly 6 fields (maxResults=6)"
    );

    // Page 2: startAt=6&maxResults=6
    let resp2 = client
        .get(format!(
            "{}/rest/api/3/issue/createmeta/MYPROJ/issuetypes/10001?startAt=6&maxResults=6",
            common::v3_base()
        ))
        .header("Authorization", auth_header())
        .send()
        .await
        .expect("Page 2 request failed");
    assert_eq!(resp2.status().as_u16(), 200);
    let body2: serde_json::Value = resp2.json().await.expect("Page 2 invalid JSON");

    assert_eq!(
        body2["total"], 10,
        "Bug createmeta total on page 2 should still be 10"
    );
    let page2_fields = body2["fields"]
        .as_array()
        .expect("page2 fields should be an array");
    assert_eq!(
        page2_fields.len(),
        4,
        "Page 2 should return exactly 4 fields (remaining)"
    );

    // Combine and verify 10 unique fieldIds
    let mut all_field_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
    for f in page1_fields.iter().chain(page2_fields.iter()) {
        let field_id = f["fieldId"]
            .as_str()
            .expect("fieldId should be a string")
            .to_string();
        all_field_ids.insert(field_id);
    }
    assert_eq!(
        all_field_ids.len(),
        10,
        "Combining both pages should yield 10 unique fieldIds"
    );
}
