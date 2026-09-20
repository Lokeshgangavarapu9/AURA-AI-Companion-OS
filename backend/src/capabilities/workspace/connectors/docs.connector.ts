/**
 * AURA Google Docs Connector
 * Mission 6.6: Document creation and text extraction via Google Docs REST API v1.
 */

export interface GoogleDocSummary {
  documentId: string;
  title: string;
  contentSnippet?: string;
}

export class DocsConnector {
  private readonly baseUrl = 'https://docs.googleapis.com/v1/documents';

  public async getDocument(accessToken: string, documentId: string): Promise<GoogleDocSummary> {
    const res = await fetch(`${this.baseUrl}/${documentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Docs API error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const doc = await res.json() as any;
    // Extract plain text from document elements
    let extractedText = '';
    for (const item of doc.body?.content || []) {
      for (const element of item.paragraph?.elements || []) {
        if (element.textRun?.content) {
          extractedText += element.textRun.content;
        }
      }
    }

    return {
      documentId: doc.documentId,
      title: doc.title || 'Untitled Document',
      contentSnippet: extractedText.trim().substring(0, 1000),
    };
  }

  public async createDocument(accessToken: string, title: string, initialContent?: string): Promise<GoogleDocSummary> {
    // 1. Create document
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Docs creation error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const doc = await res.json() as any;

    // 2. Insert initial content if provided
    if (initialContent) {
      await fetch(`${this.baseUrl}/${doc.documentId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: initialContent,
              },
            },
          ],
        }),
      });
    }

    return {
      documentId: doc.documentId,
      title: doc.title,
      contentSnippet: initialContent,
    };
  }
}

export const docsConnector = new DocsConnector();
