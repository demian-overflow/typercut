import { getToken } from './auth';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function authHeaders(): HeadersInit {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export type SessionSource = 'snippet' | 'generated' | 'manual';

export interface SessionStats {
  wpm: number;
  accuracy: number;
  duration_seconds: number;
  total_keystrokes: number;
  correct_keystrokes: number;
}

/** Call when the user starts typing. Returns the session id. */
export async function startSession(
  text: string,
  source: SessionSource,
  snippet_id?: string,
): Promise<string> {
  const res = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ text, source, snippet_id: snippet_id ?? null }),
  });
  if (!res.ok) throw new Error(`Failed to start session: ${res.status}`);
  const { id } = await res.json() as { id: string };
  return id;
}

/** Call when the user finishes typing. */
export async function completeSession(
  sessionId: string,
  stats: SessionStats,
): Promise<void> {
  const res = await fetch(`${API}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'completed', ...stats }),
  });
  if (!res.ok) throw new Error(`Failed to complete session: ${res.status}`);
}

/** Call when the user navigates away mid-session. */
export async function abandonSession(sessionId: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status: 'abandoned' }),
  }).catch(() => {}); // best-effort, don't block navigation
}
