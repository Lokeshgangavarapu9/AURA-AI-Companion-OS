/**
 * AURA Google Tasks Connector
 * Mission 6.6: Task listing and task creation via Google Tasks REST API v1.
 */

export interface GoogleTaskSummary {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
}

export class TasksConnector {
  private readonly baseUrl = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

  public async listTasks(accessToken: string, showCompleted = false): Promise<GoogleTaskSummary[]> {
    const url = new URL(this.baseUrl);
    url.searchParams.set('showCompleted', showCompleted ? 'true' : 'false');
    url.searchParams.set('maxResults', '25');

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Tasks API error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const data = await res.json() as any;
    return (data.items || []).map((t: any) => ({
      id: t.id,
      title: t.title || 'Untitled Task',
      notes: t.notes,
      status: t.status,
      due: t.due,
    }));
  }

  public async createTask(
    accessToken: string,
    title: string,
    notes?: string,
    dueDate?: string
  ): Promise<GoogleTaskSummary> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        notes,
        due: dueDate,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Task creation error (${res.status}): ${(err as any).error?.message || res.statusText}`);
    }

    const item = await res.json() as any;
    return {
      id: item.id,
      title: item.title,
      notes: item.notes,
      status: item.status,
      due: item.due,
    };
  }
}

export const tasksConnector = new TasksConnector();
