import { getToken } from './auth';
import type { Snippet } from './materials';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
}

export interface CutCollection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export async function listCutCollections(): Promise<CutCollection[]> {
  const res = await fetch(`${API}/cut-collections`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch collections: ${res.status}`);
  return res.json() as Promise<CutCollection[]>;
}

export async function createCutCollection(name: string, description?: string): Promise<CutCollection> {
  const res = await fetch(`${API}/cut-collections`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description: description ?? null }),
  });
  if (!res.ok) throw new Error(`Failed to create collection: ${res.status}`);
  return res.json() as Promise<CutCollection>;
}

export async function deleteCutCollection(id: string): Promise<void> {
  const res = await fetch(`${API}/cut-collections/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete collection: ${res.status}`);
}

export async function listCollectionSnippets(collectionId: string): Promise<Snippet[]> {
  const res = await fetch(`${API}/cut-collections/${collectionId}/snippets`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch snippets: ${res.status}`);
  return res.json() as Promise<Snippet[]>;
}
