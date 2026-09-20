/**
 * AURA Gmail Connector
 * Mission 6.6: List messages, read threads, and send emails via Gmail REST API v1.
 */

import { logger } from '../../../utils/logger.js';

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  date?: string;
}

export class GmailConnector {
  private readonly baseUrl = 'https://gmail.googleapis.com/gmail/v1/users/me';

  public async listMessages(accessToken: string, query?: string, maxResults = 10): Promise<GmailMessageSummary[]> {
    const url = new URL(`${this.baseUrl}/messages`);
    url.searchParams.set('maxResults', maxResults.toString());
    if (query) url.searchParams.set('q', query);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gmail API error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const data = await res.json() as any;
    const messageRefs = data.messages || [];

    // Fetch message summaries
    const summaries: GmailMessageSummary[] = [];
    for (const ref of messageRefs.slice(0, 5)) {
      try {
        const msgRes = await fetch(`${this.baseUrl}/messages/${ref.id}?format=metadata`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (msgRes.ok) {
          const msgData = await msgRes.json() as any;
          const headers = msgData.payload?.headers || [];
          const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value;
          const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value;
          const date = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value;

          summaries.push({
            id: ref.id,
            threadId: ref.threadId,
            snippet: msgData.snippet,
            subject,
            from,
            date,
          });
        }
      } catch (e) {
        logger.warn({ err: e, messageId: ref.id }, 'Failed to fetch individual message detail');
      }
    }

    return summaries;
  }

  public async sendEmail(accessToken: string, to: string, subject: string, bodyText: string): Promise<{ id: string }> {
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      bodyText,
    ];
    const rawEmail = Buffer.from(emailLines.join('\r\n')).toString('base64url');

    const res = await fetch(`${this.baseUrl}/messages/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEmail }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gmail Send error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    return await res.json() as { id: string };
  }
}

export const gmailConnector = new GmailConnector();
