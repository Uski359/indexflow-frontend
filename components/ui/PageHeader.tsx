import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
};

const PageHeader = ({ title, subtitle, eyebrow, actions }: PageHeaderProps) => {
  return (
    <header className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/90 p-6 shadow-card ring-1 ring-white/5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h1>
        {subtitle ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
};

export default PageHeader;
