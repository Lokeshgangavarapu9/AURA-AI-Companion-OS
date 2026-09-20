/**
 * AURA Google Drive Connector
 * Mission 6.6: File discovery, metadata retrieval, and drive search.
 */

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export class DriveConnector {
  private readonly baseUrl = 'https://www.googleapis.com/drive/v3/files';

  public async listFiles(accessToken: string, query?: string, pageSize = 15): Promise<DriveFileSummary[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('pageSize', pageSize.toString());
    url.searchParams.set('fields', 'files(id, name, mimeType, webViewLink, modifiedTime, size)');
    if (query) {
      url.searchParams.set('q', query);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Drive API error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const data = await res.json() as any;
    return (data.files || []).map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      modifiedTime: file.modifiedTime,
      size: file.size,
    }));
  }

  public async searchFilesByName(accessToken: string, filename: string): Promise<DriveFileSummary[]> {
    const q = `name contains '${filename.replace(/'/g, "\\'")}' and trashed = false`;
    return this.listFiles(accessToken, q);
  }
}

export const driveConnector = new DriveConnector();
