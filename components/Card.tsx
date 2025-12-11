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
        'rounded-2xl border border-[#1f1f2a] bg-[#111118]/80 p-4 shadow-card backdrop-blur',
        className
      )}
    >
      {(title || subtitle || actions) && (
        <header className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </div>
  );
};

export default Card;
