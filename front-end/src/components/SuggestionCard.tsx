import type { Suggestion, SuggestionType } from '../lib/types';

const TYPE_META: Record<
  SuggestionType,
  { label: string; classes: string }
> = {
  question: {
    label: 'Question to ask',
    classes: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  talking_point: {
    label: 'Talking point',
    classes: 'bg-violet-100 text-violet-800 border-violet-200',
  },
  answer: {
    label: 'Answer',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  fact_check: {
    label: 'Fact-check',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  clarification: {
    label: 'Clarify',
    classes: 'bg-rose-100 text-rose-800 border-rose-200',
  },
};

export default function SuggestionCard({
  suggestion,
  onClick,
  selected,
}: {
  suggestion: Suggestion;
  onClick: () => void;
  selected?: boolean;
}) {
  const meta = TYPE_META[suggestion.type];
  return (
    <button
      onClick={onClick}
      className={[
        'group block w-full rounded-xl border p-4 text-left shadow-soft transition',
        selected
          ? 'border-brand-500/50 bg-brand-50/70 ring-2 ring-brand-500/30'
          : 'border-mist-200/80 bg-white/80 hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-white hover:shadow-card',
      ].join(' ')}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${meta.classes}`}
        >
          {meta.label}
        </span>
        {selected && (
          <span className="ml-auto text-[10px] font-semibold text-brand-500">
            ✓ Answered
          </span>
        )}
      </div>
      <div className="mb-1.5 text-sm font-semibold leading-snug text-brand-900">
        {suggestion.title}
      </div>
      <p className="text-xs leading-relaxed text-brand-700/80">
        {suggestion.preview}
      </p>
      {!selected && (
        <div className="mt-2 text-[11px] font-medium text-brand-500 opacity-0 transition group-hover:opacity-100">
          Tap for a detailed answer →
        </div>
      )}
    </button>
  );
}
