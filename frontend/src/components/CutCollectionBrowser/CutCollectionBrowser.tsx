import { useEffect, useState } from 'react';
import {
  listCutCollections,
  listCollectionSnippets,
  deleteCutCollection,
  createCutCollection,
  updateCutCollection,
  type CutCollection,
} from '../../lib/cutCollections';
import type { Snippet } from '../../lib/materials';

interface Props {
  onSelect: (text: string, snippetId: string) => void;
  onBack: () => void;
}

type View = 'collections' | 'snippets';

export default function CutCollectionBrowser({ onSelect, onBack }: Props) {
  const [view, setView] = useState<View>('collections');
  const [collections, setCollections] = useState<CutCollection[]>([]);
  const [activeCollection, setActiveCollection] = useState<CutCollection | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCutCollections()
      .then(setCollections)
      .catch(() => setError('Failed to load collections'))
      .finally(() => setLoading(false));
  }, []);

  const openCollection = async (col: CutCollection) => {
    setActiveCollection(col);
    setView('snippets');
    setLoading(true);
    setError(null);
    try {
      const s = await listCollectionSnippets(col.id);
      setSnippets(s);
    } catch {
      setError('Failed to load cuts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCutCollection(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const col = await createCutCollection(name);
      setCollections((prev) => [col, ...prev]);
      setNewName('');
      setAdding(false);
    } catch {
      setError('Failed to create collection');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (col: CutCollection) => {
    setEditingId(col.id);
    setEditName(col.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSave = async (id: string) => {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const updated = await updateCutCollection(id, name);
      setCollections((prev) => prev.map((c) => (c.id === id ? updated : c)));
      cancelEdit();
    } catch {
      setError('Failed to update collection');
    } finally {
      setSaving(false);
    }
  };

  const pickRandom = () => {
    if (!snippets.length) return;
    const s = snippets[Math.floor(Math.random() * snippets.length)];
    onSelect(s.text, s.id);
  };

  if (loading) {
    return <p className="text-sm text-gray-400 text-center py-6">Loading…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500 text-center py-6">{error}</p>;
  }

  // ── Snippet list view ──────────────────────────────────────────────────────

  if (view === 'snippets' && activeCollection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 truncate max-w-[65%]">
            {activeCollection.name}
          </h2>
          <button
            onClick={() => { setView('collections'); setSnippets([]); setActiveCollection(null); }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Collections
          </button>
        </div>

        {snippets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No cuts in this collection yet.</p>
        ) : (
          <>
            <p className="text-xs text-gray-400">
              {snippets.length} cut{snippets.length !== 1 ? 's' : ''} — click one to practice.
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
              onClick={pickRandom}
              className="w-full py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm font-medium transition-colors"
            >
              Random Cut
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Collection list view ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">My Collections</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAdding((v) => !v); setNewName(''); }}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            {adding ? 'Cancel' : '+ Add'}
          </button>
          <button
            onClick={onBack}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Back
          </button>
        </div>
      </div>

      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Collection name"
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-400"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 disabled:opacity-40 transition-colors"
          >
            {creating ? '…' : 'Create'}
          </button>
        </div>
      )}

      {collections.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No collections yet. Create one or ingest some material.
        </p>
      ) : (
        <ul className="space-y-2">
          {collections.map((col) => (
            <li key={col.id} className="flex items-center gap-2">
              {editingId === col.id ? (
                <div className="flex flex-1 gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave(col.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="flex-1 px-3 py-1.5 text-sm border border-indigo-300 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => handleSave(col.id)}
                    disabled={saving || !editName.trim()}
                    className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 disabled:opacity-40 transition-colors"
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => openCollection(col)}
                    className="flex-1 text-left px-4 py-3 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-lg transition-colors group"
                  >
                    <span className="block text-sm font-medium text-gray-800 group-hover:text-indigo-700">
                      {col.name}
                    </span>
                    <span className="block mt-0.5 text-xs text-gray-400">
                      {new Date(col.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    onClick={() => startEdit(col)}
                    className="p-2 text-gray-300 hover:text-indigo-400 transition-colors"
                    title="Rename collection"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete(col.id)}
                    className="p-2 text-gray-300 hover:text-red-400 transition-colors"
                    title="Delete collection"
                  >
                    ✕
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
