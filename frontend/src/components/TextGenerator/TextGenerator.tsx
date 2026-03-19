import { useState } from 'react';
import { generateText, type TextStyle, type TextLength } from '../../lib/textGenerator';

interface Props {
  onGenerated: (text: string) => void;
}

export default function TextGenerator({ onGenerated }: Props) {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<TextStyle>('prose');
  const [length, setLength] = useState<TextLength>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const text = await generateText(topic.trim(), style, length);
      onGenerated(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder="e.g. React hooks, Roman history, Go concurrency..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as TextStyle)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="prose">Prose</option>
            <option value="quotes">Quotes</option>
            <option value="code">Code snippet</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as TextLength)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="short">Short (~30 words)</option>
            <option value="medium">Medium (~60 words)</option>
            <option value="long">Long (~120 words)</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading || !topic.trim()}
        className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        {loading ? 'Generating...' : 'Generate Text'}
      </button>
    </div>
  );
}
