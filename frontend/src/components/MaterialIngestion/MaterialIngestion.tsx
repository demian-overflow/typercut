import { useRef, useState } from 'react';
import {
  createMaterial,
  ingestFromGitHub,
  processMaterial,
  uploadFile,
  type IngestResult,
  type Snippet,
} from '../../lib/materials';

interface Props {
  onSnippetsReady: (snippets: Snippet[]) => void;
}

type Tab = 'paste' | 'file' | 'github';

const ACCEPTED = '.pdf,.md,.txt,.srt,.vtt';

export default function MaterialIngestion({ onSnippetsReady }: Props) {
  const [tab, setTab] = useState<Tab>('paste');

  const handleResult = (result: IngestResult) => {
    onSnippetsReady(result.snippets);
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        {([['paste', 'Paste Text'], ['file', 'Upload File'], ['github', 'GitHub']] as [Tab, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {tab === 'paste' && <PasteTab onResult={handleResult} />}
      {tab === 'file' && <FileTab onResult={handleResult} />}
      {tab === 'github' && <GitHubTab onResult={handleResult} />}
    </div>
  );
}

// ── Paste ─────────────────────────────────────────────────────────────────────

function PasteTab({ onResult }: { onResult: (r: IngestResult) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const material = await createMaterial(title.trim(), content.trim());
      const snippets = await processMaterial(material.id);
      onResult({ material: { id: material.id, title: material.title }, snippets });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Chapter 3 — Mitosis, React Hooks docs..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={busy}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Material{' '}
          {wordCount > 0 && <span className="text-gray-400 font-normal">({wordCount} words)</span>}
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste any text — an article, lecture notes, documentation, a book chapter…"
          rows={7}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono"
          disabled={busy}
        />
        <p className="text-xs text-gray-400 mt-1">
          AI will extract short, typable phrases from this material.
        </p>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={busy || !title.trim() || !content.trim()}
        className="w-full py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        {busy ? 'Processing with AI…' : 'Ingest & Extract Snippets'}
      </button>
    </div>
  );
}

// ── File upload ───────────────────────────────────────────────────────────────

function FileTab({ onResult }: { onResult: (r: IngestResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const result = await uploadFile(file);
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-indigo-400 bg-indigo-50'
            : file
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <>
            <p className="text-sm font-medium text-green-700">{file.name}</p>
            <p className="text-xs text-green-500 mt-1">
              {(file.size / 1024).toFixed(0)} KB — click to change
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500">Drop a file here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">PDF, Markdown, TXT, SRT, VTT — max 10 MB</p>
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={busy || !file}
        className="w-full py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        {busy ? 'Extracting & Processing with AI…' : 'Upload & Extract Snippets'}
      </button>
    </div>
  );
}

// ── GitHub ────────────────────────────────────────────────────────────────────

function GitHubTab({ onResult }: { onResult: (r: IngestResult) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!url.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const result = await ingestFromGitHub(url.trim());
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">GitHub URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="https://github.com/owner/repo/blob/main/README.md"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
          disabled={busy}
        />
        <p className="text-xs text-gray-400 mt-1">
          Paste a file URL or a repo root URL (fetches README). Public repos only.
        </p>
      </div>

      <div className="text-xs text-gray-400 space-y-1 bg-gray-50 rounded-lg px-3 py-2">
        <p className="font-medium text-gray-500">Examples:</p>
        <p>github.com/owner/repo <span className="text-gray-300">→ README.md</span></p>
        <p>github.com/owner/repo/blob/main/docs/guide.md</p>
        <p>github.com/owner/repo/blob/main/src/lib.rs</p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={busy || !url.trim()}
        className="w-full py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        {busy ? 'Fetching & Processing with AI…' : 'Fetch & Extract Snippets'}
      </button>
    </div>
  );
}
