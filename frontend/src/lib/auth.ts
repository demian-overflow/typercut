const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'typercut_token';

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function loginUrl(): string {
  return `${API}/auth/google`;
}

export async function fetchMe(): Promise<User> {
  const token = getToken();
  if (!token) throw new Error('No token');

  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    clearToken();
    throw new Error('Unauthorized');
  }

  return res.json() as Promise<User>;
}
