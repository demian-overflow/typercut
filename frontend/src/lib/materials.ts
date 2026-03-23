import { getToken } from './auth';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

function authHeadersNoContentType(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Material {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface Snippet {
  id: string;
  material_id: string;
  text: string;
  word_count: number;
}

export async function createMaterial(title: string, content: string): Promise<Material> {
  const res = await fetch(`${API}/materials`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error(`Failed to create material: ${res.status}`);
  return res.json() as Promise<Material>;
}

export async function listMaterials(): Promise<Material[]> {
  const res = await fetch(`${API}/materials`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch materials: ${res.status}`);
  return res.json() as Promise<Material[]>;
}

export async function processMaterial(id: string): Promise<Snippet[]> {
  const res = await fetch(`${API}/materials/${id}/process`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Processing failed: ${res.status}`);
  return res.json() as Promise<Snippet[]>;
}

export async function listSnippets(materialId: string): Promise<Snippet[]> {
  const res = await fetch(`${API}/materials/${materialId}/snippets`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch snippets: ${res.status}`);
  return res.json() as Promise<Snippet[]>;
}

export interface IngestResult {
  cut_collection?: { id: string; name: string };
  material: { id: string; title: string };
  snippets: Snippet[];
}

async function handleIngestError(res: Response): Promise<never> {
  let msg = `Request failed (${res.status})`;
  try {
    const body = await res.json() as { error?: string };
    if (body.error) msg = body.error;
  } catch { /* ignore */ }
  throw new Error(msg);
}

export async function uploadFile(file: File): Promise<IngestResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API}/materials/upload`, {
    method: 'POST',
    headers: authHeadersNoContentType(),
    body: form,
  });
  if (!res.ok) return handleIngestError(res);
  return res.json() as Promise<IngestResult>;
}

export async function ingestFromGitHub(url: string): Promise<IngestResult> {
  const res = await fetch(`${API}/materials/from-github`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  });
  if (!res.ok) return handleIngestError(res);
  return res.json() as Promise<IngestResult>;
}

export async function randomSnippet(): Promise<Snippet | null> {
  const res = await fetch(`${API}/snippets/random`, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch snippet: ${res.status}`);
  return res.json() as Promise<Snippet>;
}
