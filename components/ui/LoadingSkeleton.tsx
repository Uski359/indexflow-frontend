import classNames from 'classnames';

type LoadingSkeletonProps = {
  lines?: number;
  className?: string;
  showHeader?: boolean;
};

const LoadingSkeleton = ({
  lines = 3,
  className,
  showHeader = true
}: LoadingSkeletonProps) => {
  return (
    <div className={classNames('space-y-3', className)}>
      {showHeader ? <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" /> : null}
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={classNames(
            'h-4 animate-pulse rounded-full bg-white/5',
            index === lines - 1 ? 'w-2/3' : 'w-full'
          )}
        />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
