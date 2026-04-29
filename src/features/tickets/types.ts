// Triage state values — matches SQLite CHECK constraint
export type TriageState = 'new' | 'seen' | 'ignored' | 'copied' | 'handled';

// JQL preset options — matches fetch_config.jql_preset column
export type JqlPreset = 'mine' | 'all_watched' | 'custom';

// Fetch status for loading states
export type FetchStatus = 'idle' | 'loading' | 'error';

// Jira user (camelCase — Tauri serializes Rust snake_case to camelCase)
export interface JiraUser {
  name?: string; // Server v2
  accountId?: string; // Cloud v3
  displayName: string;
  avatarUrls?: Record<string, string>; // e.g. { "48x48": url, "24x24": url, "16x16": url, "32x32": url }
  emailAddress?: string; // Cloud v3 — absent (not null) when user hides email
}

// Jira status
export interface JiraStatus {
  name: string;
  id?: string;
  statusCategory?: { key: string };
}

// Jira priority
export interface JiraPriority {
  name: string;
  id: string;
}

// Jira comment
export interface JiraComment {
  id: string;
  author: JiraUser;
  body: string | Record<string, unknown>; // string for v2, ADF object for v3
  created: string; // ISO 8601
}

// Jira attachment
export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  content: string; // download URL
}

// Jira issue link
export interface JiraIssueLink {
  id: string;
  type: { name: string; inward: string; outward: string };
  outwardIssue?: { key: string; fields: { summary: string; status: JiraStatus } };
  inwardIssue?: { key: string; fields: { summary: string; status: JiraStatus } };
}

// Sub-task
export interface JiraSubTask {
  key: string;
  fields: { summary: string; status: JiraStatus };
}

// Component
export interface JiraComponent {
  name: string;
}

// Fix version
export interface JiraFixVersion {
  name: string;
}

// Work log entry
export interface JiraWorklog {
  id: string;
  author: JiraUser;
  comment: string;
  started: string; // ISO 8601
  timeSpent: string; // e.g. "2h"
  timeSpentSeconds: number;
}

// Changelog history item
export interface ChangelogItem {
  field: string;
  fromString: string | null;
  toString: string | null;
}

// Changelog history entry
export interface ChangelogEntry {
  id: string;
  author: JiraUser;
  created: string; // ISO 8601
  items: ChangelogItem[];
}

// Ticket as returned from search (lightweight — list view fields only)
export interface JiraTicket {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;
    created?: string; // ISO 8601 — may be absent for older cached tickets
    updated: string; // ISO 8601
  };
}

// Full ticket detail (all fields, returned from individual issue fetch)
export interface JiraTicketDetail {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: JiraStatus;
    priority: JiraPriority;
    assignee: JiraUser | null;
    reporter: JiraUser | null;
    description: string | Record<string, unknown> | null; // string for v2, ADF for v3
    labels: string[];
    components: JiraComponent[];
    fixVersions: JiraFixVersion[];
    comment: { comments: JiraComment[] };
    attachment: JiraAttachment[];
    subtasks: JiraSubTask[];
    issuelinks: JiraIssueLink[];
    created?: string; // ISO 8601
    updated: string;
    // Phase 22: issue type for default selection in copy preview (D-05)
    issuetype?: { id?: string; name: string };
  };
  renderedFields?: {
    description?: string; // HTML from expand=renderedFields (v2 only)
  };
  changelog?: {
    histories: ChangelogEntry[];
  };
}

export interface WatchedUser {
  identifier: string;
  displayName: string;
  email?: string;
}

// Fetch config — mirrors Rust FetchConfig struct
export interface FetchConfig {
  jqlPreset: JqlPreset;
  jqlCustom: string | null;
  watchedUsers: WatchedUser[];
  lastFetchedAt: string | null;
}

// Result from fetch_tickets Tauri command
export interface FetchTicketsResult {
  issues: JiraTicket[];
  total: number;
  triageMap: Record<string, TriageEntry>;
  // True when the matching set exceeded the backend's MAX_PAGINATION_ITEMS cap
  // and the result was truncated. The UI surfaces a warning so users know to
  // tighten their JQL. See debug session: jira-fetch-pagination-50-cap.
  truncated: boolean;
}

// --- Copy Pipeline Types (Phase 4) ---

export type CopyPhase = 'idle' | 'loading_preview' | 'previewing' | 'copying' | 'result';

export interface CopyStepResult {
  step: string; // "create_issue" | "convert_description" | "upload_images" | "add_remote_link"
  success: boolean;
  detail: string | null; // error message or created key
}

export interface CopyTicketResult {
  targetKey: string | null;
  targetUrl: string | null;
  steps: CopyStepResult[];
}

export interface CloudMeta {
  availableStatuses: { id: string; name: string }[];
  availablePriorities: { id: string; name: string }[];
  currentAccountId: string;
  cloudBaseUrl: string;
}

export interface TriageEntry {
  state: TriageState;
  copiedKey: string | null;
}

// --- Audit Log Types (Phase 6) ---

export interface AuditEntry {
  id: number | null;
  timestamp: string; // ISO 8601 UTC
  method: string; // GET, POST, etc.
  url: string;
  headers: string; // JSON string, Authorization = "[REDACTED]"
  statusCode: number | null; // camelCase from Rust snake_case
  responseBody: string | null; // Truncated at 10KB, often null
}

// --- Field Transformation Audit (quick task 260430-0tj) ---

export interface MappingAuditEntry {
  id: number;
  copyId: string;
  fieldId: string;
  sourceValueHash: string;
  targetValueHash: string;
  wasOverridden: boolean;
  gapKind: string | null;
  transformerKind: string;
  outcome: 'ok' | 'failed' | 'skipped';
  failureReason: string | null;
  timestamp: string;
}
