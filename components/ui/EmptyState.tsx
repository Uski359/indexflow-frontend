import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

const EmptyState = ({ title, description, action, compact = false }: EmptyStateProps) => {
  return (
    <div
      className={`rounded-3xl border border-dashed border-border/80 bg-background/50 text-center ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-slate-300">
        <Inbox size={18} />
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-slate-300">{description}</p>
      </div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
};

export default EmptyState;
