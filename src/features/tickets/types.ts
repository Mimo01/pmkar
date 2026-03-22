// Triage state values — matches SQLite CHECK constraint
export type TriageState = 'new' | 'seen' | 'ignored' | 'copied';

// JQL preset options — matches fetch_config.jql_preset column
export type JqlPreset = 'assigned' | 'mentioned' | 'all_watched' | 'custom';

// Fetch status for loading states
export type FetchStatus = 'idle' | 'loading' | 'error';

// Jira user (camelCase — Tauri serializes Rust snake_case to camelCase)
export interface JiraUser {
  name?: string;        // Server v2
  accountId?: string;   // Cloud v3
  displayName: string;
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
  body: string | Record<string, unknown>;  // string for v2, ADF object for v3
  created: string;  // ISO 8601
}

// Jira attachment
export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  content: string;  // download URL
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
  started: string;     // ISO 8601
  timeSpent: string;   // e.g. "2h"
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
  created: string;  // ISO 8601
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
    updated: string;  // ISO 8601
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
    description: string | Record<string, unknown> | null;  // string for v2, ADF for v3
    labels: string[];
    components: JiraComponent[];
    fixVersions: JiraFixVersion[];
    comment: { comments: JiraComment[] };
    attachment: JiraAttachment[];
    subtasks: JiraSubTask[];
    issuelinks: JiraIssueLink[];
    updated: string;
  };
  renderedFields?: {
    description?: string;  // HTML from expand=renderedFields (v2 only)
  };
  changelog?: {
    histories: ChangelogEntry[];
  };
}

// Fetch config — mirrors Rust FetchConfig struct
export interface FetchConfig {
  jqlPreset: JqlPreset;
  jqlCustom: string | null;
  watchedUsers: string[];
  lastFetchedAt: string | null;
}

// Result from fetch_tickets Tauri command
export interface FetchTicketsResult {
  issues: JiraTicket[];
  total: number;
  triageMap: Record<string, TriageState>;
}

// --- Copy Pipeline Types (Phase 4) ---

export type CopyPhase = 'idle' | 'loading_preview' | 'previewing' | 'copying' | 'result';

export interface CopyStepResult {
  step: string;        // "create_issue" | "convert_description" | "upload_images" | "add_remote_link"
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
