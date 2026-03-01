import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

const ErrorState = ({ title, description, action, compact = false }: ErrorStateProps) => {
  return (
    <div
      className={`rounded-3xl border border-rose-500/30 bg-rose-500/10 text-center ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-200">
        <AlertTriangle size={18} />
      </div>
      <div className="mt-4 space-y-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-sm text-rose-100/90">{description}</p>
      </div>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
};

export default ErrorState;
