import { useEffect, useMemo, useState } from 'react';
import EssayArticle from '../EssayArticle/EssayArticle';
import type { Essay } from '../../fixtures/scheduler-essay';
import './ReaderPage.css';

interface ReaderPageProps {
  essay: Essay;
  toc?: { number: string; title: string; slug: string; done?: boolean; active?: boolean }[];
}

export default function ReaderPage({ essay, toc }: ReaderPageProps) {
  useEffect(() => {
    document.body.classList.add('reader-mode');
    return () => document.body.classList.remove('reader-mode');
  }, []);

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const defaultToc = useMemo(
    () => [
      { number: 'i', title: 'Why inference is hard', slug: 'i', done: true },
      { number: 'ii', title: 'Memory, not compute', slug: 'ii', done: true },
      { number: 'iii', title: 'PagedAttention from scratch', slug: 'iii', done: true },
      { number: 'iv', title: 'The scheduler, line by line', slug: 'iv', active: true },
      { number: 'v', title: 'Continuous batching', slug: 'v' },
      { number: 'vi', title: 'Attention backends', slug: 'vi' },
      { number: 'vii', title: 'Quantization paths', slug: 'vii' },
      { number: 'viii', title: 'Distributed inference', slug: 'viii' },
      { number: 'ix', title: 'Reading other engines', slug: 'ix' },
      { number: 'x', title: 'The capstone', slug: 'x' },
    ],
    [],
  );
  const tocItems = toc ?? defaultToc;

  return (
    <div className="reader-page">
      <div className="reader-progress">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>

      <aside className="reader-toc">
        <div className="reader-toc-head">
          <span className="course-label">Course · {essay.course.slug}</span>
          <div className="course-title">{essay.course.title}</div>
        </div>
        <div className="reader-toc-list">
          {tocItems.map((item) => (
            <button
              key={item.slug}
              className={`reader-toc-item ${item.done ? 'done' : ''} ${item.active ? 'active' : ''}`}
              type="button"
            >
              <span className="n">{item.number}.</span>
              <span className="name">{item.title}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="reader-main">
        <header className="reader-header">
          <a href="/" className="brand">
            typercut<span className="dot">.</span>
          </a>
          <div className="crumbs">
            <span>Library</span>
            <span className="sep">/</span>
            <span>{essay.course.title}</span>
            <span className="sep">/</span>
            <span className="cur">
              Essay {essay.number}
            </span>
          </div>
          <div className="actions">
            <a href="/">Library</a>
            <a href="/app">Sign in</a>
          </div>
        </header>

        <div className="reader-top">
          <span className="pos">
            Essay {essay.number} · of {numeralFor(essay.position.total)} · {Math.round((essay.position.current / essay.position.total) * 100)}% through the course
          </span>
          <span className="read-time">~{essay.readingMinutes} minutes</span>
        </div>

        <EssayArticle essay={essay} />

        <nav className="reader-bottom-bar">
          {essay.prev ? (
            <button type="button" className="nav-link prev">
              <span className="label">← Previous</span>
              <span className="name">
                {essay.prev.number}. {essay.prev.title}
              </span>
            </button>
          ) : (
            <span />
          )}
          {essay.next && (
            <button type="button" className="nav-link next">
              <span className="label">Next →</span>
              <span className="name">
                {essay.next.number}. {essay.next.title}
              </span>
            </button>
          )}
        </nav>
      </main>

      <aside className="reader-aside">
        {essay.marginNotes && essay.marginNotes.length > 0 && (
          <div className="aside-block">
            <h4 className="aside-h">Author's margin · {essay.marginNotes.length}</h4>
            {essay.marginNotes.map((note, i) => (
              <div key={i} className="margin-note">
                "{note.text}"
                <span className="who">— {note.author} · ¶{note.anchor.replace('p', '')}</span>
              </div>
            ))}
          </div>
        )}

        <div className="aside-block">
          <h4 className="aside-h">Read by typing</h4>
          <button type="button" className="type-through-cta">
            Type through this essay →
            <span className="desc">
              The original Typercut bet — deliberate reading via keyboard.
            </span>
          </button>
        </div>

        <div className="aside-block">
          <h4 className="aside-h">In the salon</h4>
          <div className="margin-note" style={{ borderLeftColor: 'var(--border)', background: 'transparent' }}>
            Salon, highlights, and a private notebook ship in the next release.
            <span className="who">— PR 3 + PR 4</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

function numeralFor(n: number): string {
  const numerals = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
  return numerals[n] ?? String(n);
}
