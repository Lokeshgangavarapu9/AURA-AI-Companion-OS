/**
 * AURA Google Calendar Connector
 * Mission 6.6: List upcoming calendar events and create schedule entries.
 */

export interface CalendarEventSummary {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

export class CalendarConnector {
  private readonly baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  public async listUpcomingEvents(accessToken: string, maxResults = 10): Promise<CalendarEventSummary[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('maxResults', maxResults.toString());
    url.searchParams.set('timeMin', new Date().toISOString());
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Calendar API error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const data = await res.json() as any;
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || 'Untitled Event',
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      description: item.description,
      location: item.location,
    }));
  }

  public async createEvent(
    accessToken: string,
    summary: string,
    startTime: string,
    endTime: string,
    description?: string
  ): Promise<CalendarEventSummary> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Calendar Event creation error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const item = await res.json() as any;
    return {
      id: item.id,
      summary: item.summary,
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      description: item.description,
    };
  }
}

export const calendarConnector = new CalendarConnector();
