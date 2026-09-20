/**
 * AURA Workspace Integrations — API Routes
 * Mission 6.6: OAuth initiation, callback, status inquiry, and tool execution.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateUser } from '../../middleware/auth.middleware.js';
import { googleOAuthService } from '../../capabilities/workspace/oauth.service.js';
import { workspaceTokenStorage } from '../../capabilities/workspace/token.storage.js';
import { gmailConnector } from '../../capabilities/workspace/connectors/gmail.connector.js';
import { calendarConnector } from '../../capabilities/workspace/connectors/calendar.connector.js';
import { driveConnector } from '../../capabilities/workspace/connectors/drive.connector.js';
import { docsConnector } from '../../capabilities/workspace/connectors/docs.connector.js';
import { tasksConnector } from '../../capabilities/workspace/connectors/tasks.connector.js';
import { HTTP_STATUS } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

const workspaceRouter = Router();

/**
 * GET /api/v1/workspace/auth/url
 * Returns Google Workspace OAuth authorization URL
 */
workspaceRouter.get('/workspace/auth/url', authenticateUser, async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  if (!googleOAuthService.isConfigured()) {
    res.status(HTTP_STATUS.OK).json({
      status: 'unconfigured',
      message: 'Google Workspace OAuth is not yet configured on this instance.',
      requiredVariables: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'],
      instructions:
        'Create a Google Cloud Project, enable Gmail, Calendar, Drive, Docs, and Tasks APIs, configure OAuth Consent Screen, create OAuth 2.0 Web Client, and set environment variables.',
    });
    return;
  }

  try {
    const authUrl = googleOAuthService.getAuthorizationUrl(userId);
    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: { url: authUrl },
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to generate Workspace auth URL');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      error: { message: err.message || 'Failed to generate auth URL' },
    });
  }
});

/**
 * GET /api/v1/workspace/auth/callback
 * Handles Google OAuth redirect callback and exchanges code
 */
workspaceRouter.get('/workspace/auth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.warn({ error }, 'Google OAuth callback returned error');
    res.status(HTTP_STATUS.BAD_REQUEST).send(`Google OAuth Authorization Failed: ${error}`);
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(HTTP_STATUS.BAD_REQUEST).send('Missing authorization code in callback');
    return;
  }

  let userId = '';
  try {
    if (state && typeof state === 'string') {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      userId = decoded.userId;
    }
  } catch {
    logger.warn('Failed to parse OAuth state payload');
  }

  if (!userId) {
    res.status(HTTP_STATUS.BAD_REQUEST).send('Invalid or missing OAuth state / userId');
    return;
  }

  try {
    const tokens = await googleOAuthService.exchangeCodeForTokens(code);
    await workspaceTokenStorage.saveTokens(userId, tokens);

    logger.info({ userId }, '🎉 Successfully connected Google Workspace account');

    // Return HTML confirmation that closes or redirects
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AURA Workspace Connected</title>
          <style>
            body { background: #0f172a; color: #f8fafc; font-family: monospace; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; border: 1px solid #334155; text-align: center; max-width: 400px; }
            h2 { color: #10b981; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✓ Workspace Connected</h2>
            <p>Your Google Workspace has been securely linked to your AURA account.</p>
            <p>You may close this tab and return to AURA.</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'AURA_WORKSPACE_CONNECTED' }, '*');
              setTimeout(() => window.close(), 1500);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    logger.error({ err }, 'OAuth token exchange failed during callback');
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(`Token exchange error: ${err.message}`);
  }
});

/**
 * GET /api/v1/workspace/status
 * Inquires connection status and available services
 */
workspaceRouter.get('/workspace/status', authenticateUser, async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const status = await workspaceTokenStorage.getConnectionStatus(userId);

  res.status(HTTP_STATUS.OK).json({
    status: 'ok',
    data: {
      ...status,
      oauthConfigured: googleOAuthService.isConfigured(),
    },
  });
});

/**
 * POST /api/v1/workspace/disconnect
 * Revokes Google Workspace token connection
 */
workspaceRouter.post('/workspace/disconnect', authenticateUser, async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  await workspaceTokenStorage.clearTokens(userId);

  res.status(HTTP_STATUS.OK).json({
    status: 'ok',
    data: { disconnected: true },
  });
});

const executeSchema = z.object({
  service: z.enum(['gmail', 'calendar', 'drive', 'docs', 'tasks']),
  action: z.string().min(1),
  params: z.record(z.string(), z.any()).optional().default({}),
});

/**
 * POST /api/v1/workspace/execute
 * Safely executes workspace actions for authenticated user
 */
workspaceRouter.post('/workspace/execute', authenticateUser, async (req: Request, res: Response) => {
  const validation = executeSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      status: 'error',
      error: { code: 'VALIDATION_ERROR', message: validation.error.issues[0]?.message },
    });
    return;
  }

  const { service, action, params } = validation.data;
  const userId = (req as any).user.userId;

  const accessToken = await workspaceTokenStorage.getValidAccessToken(userId);
  if (!accessToken) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: 'error',
      error: {
        code: 'WORKSPACE_NOT_CONNECTED',
        message: 'Google Workspace is not connected or token has expired. Re-authenticate.',
      },
    });
    return;
  }

  try {
    let result: any;
    switch (service) {
      case 'gmail':
        if (action === 'list') {
          result = await gmailConnector.listMessages(accessToken, params.query as string | undefined, params.maxResults as number | undefined);
        } else if (action === 'send') {
          result = await gmailConnector.sendEmail(accessToken, String(params.to || ''), String(params.subject || ''), String(params.body || ''));
        } else {
          throw new Error(`Unknown Gmail action: ${action}`);
        }
        break;

      case 'calendar':
        if (action === 'list') {
          result = await calendarConnector.listUpcomingEvents(accessToken, params.maxResults as number | undefined);
        } else if (action === 'create') {
          result = await calendarConnector.createEvent(
            accessToken,
            String(params.summary || 'Meeting'),
            String(params.startTime),
            String(params.endTime),
            params.description as string | undefined
          );
        } else {
          throw new Error(`Unknown Calendar action: ${action}`);
        }
        break;

      case 'drive':
        if (action === 'list' || action === 'search') {
          result = await driveConnector.listFiles(accessToken, params.query as string | undefined, params.pageSize as number | undefined);
        } else {
          throw new Error(`Unknown Drive action: ${action}`);
        }
        break;

      case 'docs':
        if (action === 'get') {
          result = await docsConnector.getDocument(accessToken, String(params.documentId));
        } else if (action === 'create') {
          result = await docsConnector.createDocument(accessToken, String(params.title || 'Untitled Document'), params.content as string | undefined);
        } else {
          throw new Error(`Unknown Docs action: ${action}`);
        }
        break;

      case 'tasks':
        if (action === 'list') {
          result = await tasksConnector.listTasks(accessToken, Boolean(params.showCompleted));
        } else if (action === 'create') {
          result = await tasksConnector.createTask(accessToken, String(params.title || 'New Task'), params.notes as string | undefined, params.dueDate as string | undefined);
        } else {
          throw new Error(`Unknown Tasks action: ${action}`);
        }
        break;
    }

    res.status(HTTP_STATUS.OK).json({
      status: 'ok',
      data: result,
    });
  } catch (err: any) {
    logger.error({ err, service, action, userId }, '❌ Workspace tool execution failed');
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      status: 'error',
      error: { code: 'EXECUTION_ERROR', message: err.message },
    });
  }
});

export default workspaceRouter;
