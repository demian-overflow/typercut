import Anthropic from '@anthropic-ai/sdk';

export type TextStyle = 'prose' | 'quotes' | 'code';
export type TextLength = 'short' | 'medium' | 'long';

const LENGTH_WORDS: Record<TextLength, number> = {
  short: 30,
  medium: 60,
  long: 120,
};

function getClient() {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;
  if (!apiKey) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY environment variable');
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function generateText(
  topic: string,
  style: TextStyle,
  length: TextLength,
): Promise<string> {
  const client = getClient();
  const words = LENGTH_WORDS[length];

  const styleGuide: Record<TextStyle, string> = {
    prose: 'a flowing informational paragraph',
    quotes: 'a series of short memorable sentences or aphorisms',
    code: 'a short code snippet with a brief explanation (no backtick fences)',
  };

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    system:
      'You generate typing exercise passages. Output only the text to type — no markdown, no headers, no quotes around the passage, no extra commentary. The text should be clean, accurate, and varied in punctuation to make it a good typing challenge.',
    messages: [
      {
        role: 'user',
        content: `Topic: "${topic}". Style: ${styleGuide[style]}. Target length: ~${words} words.`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') {
    throw new Error('No text in response');
  }
  return block.text.trim();
}
