import type { GroupColorToken } from './colors';

export interface Group {
  id: number;
  name: string;
  color: GroupColorToken;
  position: number;
  createdAt: string;
  memberCount: number;
}

export interface GroupMembership {
  groupId: number;
  issueKey: string;
}

export interface GroupMember {
  issueKey: string;
  ticketJson: string;
  addedAt: string;
}

export type GroupErrorCode =
  | 'empty'
  | 'too_long'
  | 'duplicate'
  | 'reserved'
  | 'no_scope'
  | 'not_found'
  | 'invalid_color'
  | 'invalid_issue_key'
  | 'invalid_ticket'
  | 'internal';

export type MoveDirection = 'left' | 'right';

export type GroupResult<T> = { ok: true; value: T } | { ok: false; code: GroupErrorCode };
