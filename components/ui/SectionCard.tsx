import type { ReactNode } from 'react';

import Card from '@/components/Card';

type SectionCardProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

const SectionCard = ({
  title,
  description,
  eyebrow,
  actions,
  children,
  className
}: SectionCardProps) => {
  return (
    <Card
      className={className}
      title={title}
      subtitle={description}
      actions={actions}
    >
      {eyebrow ? (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      {children}
    </Card>
  );
};

export default SectionCard;
