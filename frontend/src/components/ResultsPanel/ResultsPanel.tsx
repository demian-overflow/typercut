import type { TypingStats } from '../SpeedTyper/SpeedTyper';

interface Props {
  stats: TypingStats;
  onRetry: () => void;
  onNewText: () => void;
}

export default function ResultsPanel({ stats, onRetry, onNewText }: Props) {
  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-3 gap-4 text-center">
        <Stat label="WPM" value={stats.wpm} />
        <Stat label="Accuracy" value={`${stats.accuracy}%`} />
        <Stat label="Time" value={`${stats.durationSeconds}s`} />
      </div>

      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium"
        >
          Try Again
        </button>
        <button
          onClick={onNewText}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
        >
          New Text
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}
