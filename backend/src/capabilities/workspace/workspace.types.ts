/**
 * AURA Workspace Integrations — Domain Contracts & Types
 * Mission 6.6: Gmail, Google Calendar, Google Drive, Google Docs, and Google Tasks.
 */

export type WorkspaceProvider = 'google';

export type WorkspaceServiceType = 'gmail' | 'calendar' | 'drive' | 'docs' | 'tasks';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Unix timestamp in ms
  scope: string;
  tokenType: string;
}

export const WORKSPACE_SCOPES = {
  GMAIL: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
  ],
  CALENDAR: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  DRIVE: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file',
  ],
  DOCS: [
    'https://www.googleapis.com/auth/documents',
  ],
  TASKS: [
    'https://www.googleapis.com/auth/tasks',
  ],
  USERINFO: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
} as const;

export const ALL_WORKSPACE_SCOPES = [
  ...WORKSPACE_SCOPES.GMAIL,
  ...WORKSPACE_SCOPES.CALENDAR,
  ...WORKSPACE_SCOPES.DRIVE,
  ...WORKSPACE_SCOPES.DOCS,
  ...WORKSPACE_SCOPES.TASKS,
  ...WORKSPACE_SCOPES.USERINFO,
];

export interface WorkspaceConnectionStatus {
  connected: boolean;
  email?: string;
  scopes: string[];
  expiresAt?: string;
  services: {
    gmail: boolean;
    calendar: boolean;
    drive: boolean;
    docs: boolean;
    tasks: boolean;
  };
}
