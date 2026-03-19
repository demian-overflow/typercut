import { useState, useEffect, useRef, useCallback } from 'react';

export interface TypingStats {
  wpm: number;
  accuracy: number;
  durationSeconds: number;
  totalKeystrokes: number;
  correctKeystrokes: number;
}

interface CharState {
  char: string;
  status: 'pending' | 'correct' | 'incorrect';
}

interface Props {
  text: string;
  onComplete: (stats: TypingStats) => void;
  onReset?: () => void;
  onStart?: () => void;
}

function buildChars(text: string): CharState[] {
  return text.split('').map((char) => ({ char, status: 'pending' }));
}

// Group chars into word/space segments and render with word-level coloring.
// Words are green if all typed chars are correct, red if any are incorrect.
// The cursor underline shows on the current character.
function renderWords(chars: CharState[], currentIndex: number, showCursor: boolean) {
  // Segment into runs of word-chars and space-chars
  type Segment = { indices: number[]; isSpace: boolean };
  const segments: Segment[] = [];
  let i = 0;
  while (i < chars.length) {
    const isSpace = chars[i].char === ' ';
    const seg: Segment = { indices: [], isSpace };
    while (i < chars.length && (chars[i].char === ' ') === isSpace) {
      seg.indices.push(i);
      i++;
    }
    segments.push(seg);
  }

  return segments.map((seg) => {
    const statuses = seg.indices.map((idx) => chars[idx].status);
    const hasCursor = showCursor && seg.indices.includes(currentIndex);

    // Word color: any incorrect → red, all correct → green, else gray
    let wordColor = 'text-gray-400';
    if (!seg.isSpace) {
      if (statuses.some((s) => s === 'incorrect')) wordColor = 'text-red-500';
      else if (statuses.every((s) => s === 'correct')) wordColor = 'text-green-500';
    }

    return (
      <span key={seg.indices[0]} className={wordColor}>
        {seg.indices.map((idx) => {
          const isCursor = showCursor && idx === currentIndex;
          return (
            <span key={idx} className={isCursor ? 'border-b-2 border-blue-500' : undefined}>
              {chars[idx].char}
            </span>
          );
        })}
        {/* put cursor at start of next segment if we're at end of this one */}
        {hasCursor && currentIndex === seg.indices[seg.indices.length - 1] + 1 && null}
      </span>
    );
  });
}

export default function SpeedTyper({ text, onComplete, onReset, onStart }: Props) {
  const [chars, setChars] = useState<CharState[]>(() => buildChars(text));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0);
  const [state, setState] = useState<'idle' | 'typing' | 'done'>('idle');
  const [liveWpm, setLiveWpm] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setChars(buildChars(text));
    setCurrentIndex(0);
    setStartTime(null);
    setTotalKeystrokes(0);
    setCorrectKeystrokes(0);
    setState('idle');
    setLiveWpm(0);
    containerRef.current?.focus();
  }, [text]);

  useEffect(() => {
    if (state === 'typing') {
      timerRef.current = setInterval(() => {
        if (startTime) {
          const elapsed = (Date.now() - startTime) / 1000 / 60;
          setLiveWpm(Math.round(currentIndex / 5 / elapsed));
        }
      }, 500);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, startTime, currentIndex]);

  const reset = useCallback(() => {
    setChars(buildChars(text));
    setCurrentIndex(0);
    setStartTime(null);
    setTotalKeystrokes(0);
    setCorrectKeystrokes(0);
    setState('idle');
    setLiveWpm(0);
    containerRef.current?.focus();
  }, [text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (state === 'done') return;

      if (e.key === 'Escape') {
        reset();
        onReset?.();
        return;
      }

      if (e.key === 'Backspace') {
        if (currentIndex === 0) return;
        setChars((prev) => {
          const next = [...prev];
          next[currentIndex - 1] = { ...next[currentIndex - 1], status: 'pending' };
          return next;
        });
        setCurrentIndex((i) => i - 1);
        return;
      }

      if (e.key.length !== 1) return;

      const now = Date.now();
      if (state === 'idle') {
        setStartTime(now);
        setState('typing');
        onStart?.();
      }

      const expected = text[currentIndex];
      const isCorrect = e.key === expected;

      setTotalKeystrokes((n) => n + 1);
      if (isCorrect) setCorrectKeystrokes((n) => n + 1);

      setChars((prev) => {
        const next = [...prev];
        next[currentIndex] = { ...next[currentIndex], status: isCorrect ? 'correct' : 'incorrect' };
        return next;
      });

      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);

      if (nextIndex === text.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        const elapsed = (now - (startTime ?? now)) / 1000;
        const minutes = elapsed / 60;
        const stats: TypingStats = {
          wpm: Math.round(text.length / 5 / Math.max(minutes, 0.001)),
          accuracy: Math.round(((correctKeystrokes + (isCorrect ? 1 : 0)) / (totalKeystrokes + 1)) * 100),
          durationSeconds: Math.round(elapsed),
          totalKeystrokes: totalKeystrokes + 1,
          correctKeystrokes: correctKeystrokes + (isCorrect ? 1 : 0),
        };
        setState('done');
        onComplete(stats);
      }
    },
    [state, currentIndex, text, startTime, totalKeystrokes, correctKeystrokes, reset, onReset, onComplete],
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="outline-none"
      aria-label="Typing area — click and start typing"
      data-testid="typing-area"
    >
      {state === 'typing' && (
        <div className="flex gap-6 mb-4 text-sm text-gray-500 font-mono">
          <span>{liveWpm} WPM</span>
        </div>
      )}

      <div className="text-lg font-mono leading-relaxed tracking-wide select-none">
        {renderWords(chars, currentIndex, state !== 'done')}
      </div>

      {state === 'idle' && (
        <p className="mt-4 text-sm text-gray-400">Click here and start typing</p>
      )}

      {state !== 'done' && (
        <p className="mt-2 text-xs text-gray-300">Esc to reset</p>
      )}
    </div>
  );
}
