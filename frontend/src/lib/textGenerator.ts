export type TextStyle = 'prose' | 'quotes' | 'code';
export type TextLength = 'short' | 'medium' | 'long';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function generateText(
  topic: string,
  style: TextStyle,
  length: TextLength,
): Promise<string> {
  const response = await fetch(`${API}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, style, length }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(err.error ?? 'Generation failed');
  }

  const data = await response.json();
  return data.text;
}
