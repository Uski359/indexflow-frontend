import classNames from 'classnames';
import type { ReactNode } from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

const Card = ({ title, subtitle, actions, className, children }: CardProps) => {
  return (
    <div
      className={classNames(
        'rounded-3xl border border-border/70 bg-card/90 p-5 shadow-card ring-1 ring-white/5 backdrop-blur',
        className
      )}
    >
      {(title || subtitle || actions) && (
        <header className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-slate-300">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </div>
  );
};

export default Card;
