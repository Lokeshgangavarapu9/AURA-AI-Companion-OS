/**
 * AURA Workspace Capabilities Adapter
 * Mission 6.6: Exposes Workspace connectors as standard ICapability plugins in the CapabilityRegistry.
 */

import {
  ICapability,
  CapabilityMetadata,
  CapabilityCategory,
  CapabilityPermission,
  CapabilityExecutionContext,
  CapabilityResult,
} from '../types/capability.types.js';
import { workspaceTokenStorage } from './token.storage.js';
import { gmailConnector } from './connectors/gmail.connector.js';
import { calendarConnector } from './connectors/calendar.connector.js';
import { driveConnector } from './connectors/drive.connector.js';
import { docsConnector } from './connectors/docs.connector.js';
import { tasksConnector } from './connectors/tasks.connector.js';

/** Helper to extract authenticated user token from context */
async function getAccessToken(context: CapabilityExecutionContext): Promise<string> {
  const userId = context.runtimeContext?.userId || context.requestedBy;
  if (!userId) {
    throw new Error('Workspace capabilities require an authenticated user context');
  }
  const token = await workspaceTokenStorage.getValidAccessToken(userId);
  if (!token) {
    throw new Error('User has not connected Google Workspace. Please authorize via /api/v1/workspace/auth/url');
  }
  return token;
}

// 1. GMAIL READ CAPABILITY
export class GmailReadCapability implements ICapability<{ query?: string; maxResults?: number }> {
  public readonly metadata: CapabilityMetadata = {
    id: 'workspace_gmail_read',
    name: 'Read Gmail Messages',
    description: 'Searches and reads recent messages from the user\'s connected Gmail account',
    category: CapabilityCategory.HISTORY,
    version: '1.0.0',
    requiredPermissions: [CapabilityPermission.READ_HISTORY],
    executionCostTokens: 30,
    status: 'active',
  };

  public validateInput(input: { query?: string; maxResults?: number }) {
    return { valid: true };
  }

  public async execute(
    input: { query?: string; maxResults?: number },
    context: CapabilityExecutionContext
  ): Promise<CapabilityResult> {
    const start = Date.now();
    try {
      const token = await getAccessToken(context);
      const messages = await gmailConnector.listMessages(token, input.query, input.maxResults);
      return { success: true, data: messages, executionTimeMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, executionTimeMs: Date.now() - start };
    }
  }

  public async checkHealth(): Promise<boolean> {
    return true;
  }
}

// 2. CALENDAR LIST CAPABILITY
export class CalendarListCapability implements ICapability<{ maxResults?: number }> {
  public readonly metadata: CapabilityMetadata = {
    id: 'workspace_calendar_list',
    name: 'List Upcoming Calendar Events',
    description: 'Lists upcoming calendar events and meetings from Google Calendar',
    category: CapabilityCategory.CALENDAR,
    version: '1.0.0',
    requiredPermissions: [CapabilityPermission.READ_HISTORY],
    executionCostTokens: 25,
    status: 'active',
  };

  public validateInput() {
    return { valid: true };
  }

  public async execute(
    input: { maxResults?: number },
    context: CapabilityExecutionContext
  ): Promise<CapabilityResult> {
    const start = Date.now();
    try {
      const token = await getAccessToken(context);
      const events = await calendarConnector.listUpcomingEvents(token, input.maxResults);
      return { success: true, data: events, executionTimeMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, executionTimeMs: Date.now() - start };
    }
  }

  public async checkHealth(): Promise<boolean> {
    return true;
  }
}

// 3. DRIVE SEARCH CAPABILITY
export class DriveSearchCapability implements ICapability<{ filename: string }> {
  public readonly metadata: CapabilityMetadata = {
    id: 'workspace_drive_search',
    name: 'Search Google Drive Files',
    description: 'Finds documents, spreadsheets, and files stored in Google Drive',
    category: CapabilityCategory.DRIVE,
    version: '1.0.0',
    requiredPermissions: [CapabilityPermission.READ_HISTORY],
    executionCostTokens: 25,
    status: 'active',
  };

  public validateInput(input: { filename: string }) {
    if (!input.filename?.trim()) return { valid: false, reason: 'Filename search query is required' };
    return { valid: true };
  }

  public async execute(
    input: { filename: string },
    context: CapabilityExecutionContext
  ): Promise<CapabilityResult> {
    const start = Date.now();
    try {
      const token = await getAccessToken(context);
      const files = await driveConnector.searchFilesByName(token, input.filename);
      return { success: true, data: files, executionTimeMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, executionTimeMs: Date.now() - start };
    }
  }

  public async checkHealth(): Promise<boolean> {
    return true;
  }
}

// 4. TASKS LIST CAPABILITY
export class TasksListCapability implements ICapability<{ showCompleted?: boolean }> {
  public readonly metadata: CapabilityMetadata = {
    id: 'workspace_tasks_list',
    name: 'List Google Tasks',
    description: 'Retrieves user task lists and to-dos from Google Tasks',
    category: CapabilityCategory.HISTORY,
    version: '1.0.0',
    requiredPermissions: [CapabilityPermission.READ_HISTORY],
    executionCostTokens: 20,
    status: 'active',
  };

  public validateInput() {
    return { valid: true };
  }

  public async execute(
    input: { showCompleted?: boolean },
    context: CapabilityExecutionContext
  ): Promise<CapabilityResult> {
    const start = Date.now();
    try {
      const token = await getAccessToken(context);
      const tasks = await tasksConnector.listTasks(token, input.showCompleted);
      return { success: true, data: tasks, executionTimeMs: Date.now() - start };
    } catch (err: any) {
      return { success: false, error: err.message, executionTimeMs: Date.now() - start };
    }
  }

  public async checkHealth(): Promise<boolean> {
    return true;
  }
}
