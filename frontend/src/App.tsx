import { useCallback, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useHandleAuthCallback } from './auth/AuthCallback';
import LoginPage from './auth/LoginPage';
import TextGenerator from './components/TextGenerator/TextGenerator';
import MaterialIngestion from './components/MaterialIngestion/MaterialIngestion';
import SnippetBrowser from './components/SnippetBrowser/SnippetBrowser';
import CutCollectionBrowser from './components/CutCollectionBrowser/CutCollectionBrowser';
import SpeedTyper, { type TypingStats } from './components/SpeedTyper/SpeedTyper';
import ResultsPanel from './components/ResultsPanel/ResultsPanel';
import { fetchMe } from './lib/auth';
import type { Snippet } from './lib/materials';
import type { GraphData, GeneratedContent } from './lib/textGenerator';
import {
  startSession,
  completeSession,
  abandonSession,
  type SessionSource,
} from './lib/sessions';
import './index.css';

const DEFAULT_TEXT = 'The quick brown fox jumps over the lazy dog.';

export default function App() {
  return (
    <AuthProvider>
      <Inner />
    </AuthProvider>
  );
}

type AppState = 'setup' | 'collections' | 'browse' | 'typing' | 'done';
type SetupTab = 'generate' | 'ingest';

function Inner() {
  const { user, loading, logout } = useAuth();
  const [, setVersion] = useState(0);

  const onToken = useCallback(() => {
    fetchMe()
      .then(() => setVersion((n) => n + 1))
      .catch(() => {});
  }, []);

  useHandleAuthCallback(onToken);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <TypingApp user={user} onLogout={logout} />;
}

interface TypingAppProps {
  user: { name: string; picture: string | null };
  onLogout: () => void;
}

function TypingApp({ user, onLogout }: TypingAppProps) {
  const [appState, setAppState] = useState<AppState>('typing');
  const [setupTab, setSetupTab] = useState<SetupTab>('generate');
  const [pendingSnippets, setPendingSnippets] = useState<Snippet[]>([]);
  const [text, setText] = useState(DEFAULT_TEXT);
  const [graph, setGraph] = useState<GraphData | undefined>(undefined);
  const [stats, setStats] = useState<TypingStats | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSnippetId, setActiveSnippetId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<SessionSource>('manual');

  const handleGenerated = (result: GeneratedContent) => {
    setText(result.text);
    setGraph(result.graph);
    setStats(null);
    setActiveSource('generated');
    setActiveSnippetId(null);
    setAppState('typing');
  };

  const handleSnippetsReady = (snippets: Snippet[]) => {
    setPendingSnippets(snippets);
    setAppState('browse');
  };

  const handleSnippetSelected = (snippetText: string, snippetId?: string) => {
    setText(snippetText);
    setGraph(undefined);
    setStats(null);
    setActiveSource('snippet');
    setActiveSnippetId(snippetId ?? null);
    setAppState('typing');
  };

  const handleTypingStart = useCallback(() => {
    startSession(text, activeSource, activeSnippetId ?? undefined)
      .then((id) => setActiveSessionId(id))
      .catch(() => {}); // non-critical
  }, [text, activeSource, activeSnippetId]);

  const handleComplete = (s: TypingStats) => {
    setStats(s);
    setAppState('done');
    if (activeSessionId) {
      completeSession(activeSessionId, {
        wpm: s.wpm,
        accuracy: s.accuracy,
        duration_seconds: s.durationSeconds,
        total_keystrokes: s.totalKeystrokes,
        correct_keystrokes: s.correctKeystrokes,
      }).catch(() => {});
    }
  };

  const handleRetry = () => {
    if (activeSessionId) abandonSession(activeSessionId).catch(() => {});
    setActiveSessionId(null);
    setStats(null);
    setRetryKey((k) => k + 1);
    setAppState('typing');
  };

  const handleNewText = () => {
    if (activeSessionId) abandonSession(activeSessionId).catch(() => {});
    setActiveSessionId(null);
    setStats(null);
    setAppState('setup');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">typercut</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAppState('collections')}
              className="text-sm text-indigo-500 hover:text-indigo-700 font-medium"
            >
              Collections
            </button>
            {user.picture && (
              <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full" />
            )}
            <span className="text-sm text-gray-600">{user.name}</span>
            <button
              onClick={onLogout}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Cut Collection Browser */}
        {appState === 'collections' && (
          <CutCollectionBrowser
            onSelect={(t, id) => handleSnippetSelected(t, id)}
            onBack={handleNewText}
          />
        )}

        {/* Setup: two tabs */}
        {appState === 'setup' && (
          <div className="space-y-4">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setSetupTab('generate')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  setupTab === 'generate'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                AI Generate
              </button>
              <button
                onClick={() => setSetupTab('ingest')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  setupTab === 'ingest'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Ingest Material
              </button>
            </div>

            {setupTab === 'generate' && (
              <TextGenerator onGenerated={handleGenerated} />
            )}
            {setupTab === 'ingest' && (
              <MaterialIngestion onSnippetsReady={handleSnippetsReady} />
            )}

          </div>
        )}

        {/* Snippet browser after ingestion */}
        {appState === 'browse' && (
          <SnippetBrowser
            snippets={pendingSnippets}
            onSelect={(t, id) => handleSnippetSelected(t, id)}
            onBack={handleNewText}
          />
        )}

        {/* Typing + results */}
        {(appState === 'typing' || appState === 'done') && text && (
          <>
            <SpeedTyper
              key={retryKey}
              text={text}
              graph={graph}
              onComplete={handleComplete}
              onReset={handleRetry}
              onStart={handleTypingStart}
            />
            {appState === 'done' && stats && (
              <ResultsPanel
                stats={stats}
                onRetry={handleRetry}
                onNewText={handleNewText}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
