import classNames from 'classnames';
import type { ReactNode } from 'react';

import Card from '@/components/Card';

type StatTone = 'default' | 'success' | 'warning' | 'danger';

type StatCardProps = {
  title: string;
  subtitle: string;
  value: string;
  helperText: string;
  icon: ReactNode;
  status?: {
    label: string;
    tone?: StatTone;
  };
  className?: string;
};

const statusClasses: Record<StatTone, string> = {
  default: 'bg-white/5 text-slate-200',
  success: 'bg-emerald-500/10 text-emerald-200',
  warning: 'bg-amber-500/10 text-amber-100',
  danger: 'bg-rose-500/10 text-rose-100'
};

const StatCard = ({
  title,
  subtitle,
  value,
  helperText,
  icon,
  status,
  className
}: StatCardProps) => {
  return (
    <Card title={title} subtitle={subtitle} className={className}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
          <p className="text-sm text-slate-300">{helperText}</p>
          {status ? (
            <span
              className={classNames(
                'inline-flex rounded-full px-3 py-1 text-xs font-medium',
                statusClasses[status.tone ?? 'default']
              )}
            >
              {status.label}
            </span>
          ) : null}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          {icon}
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
