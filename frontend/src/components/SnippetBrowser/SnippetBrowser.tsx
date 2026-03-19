import type { Snippet } from '../../lib/materials';

interface Props {
  snippets: Snippet[];
  onSelect: (text: string, id: string) => void;
  onBack: () => void;
}

export default function SnippetBrowser({ snippets, onSelect, onBack }: Props) {
  if (snippets.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-gray-500 text-sm">No snippets were generated.</p>
        <button
          onClick={onBack}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          {snippets.length} snippet{snippets.length !== 1 ? 's' : ''} extracted
        </h2>
        <button
          onClick={onBack}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          ← New material
        </button>
      </div>

      <p className="text-xs text-gray-400">
        Click a snippet to use it as your typing exercise.
      </p>

      <ul className="space-y-2">
        {snippets.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => onSelect(s.text, s.id)}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-lg text-sm text-gray-800 transition-colors group"
            >
              <span className="block">{s.text}</span>
              <span className="block mt-1 text-xs text-gray-400 group-hover:text-indigo-400">
                {s.word_count} words
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => { const s = snippets[Math.floor(Math.random() * snippets.length)]; onSelect(s.text, s.id); }}
        className="w-full py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm font-medium transition-colors"
      >
        Random Snippet
      </button>
    </div>
  );
}
