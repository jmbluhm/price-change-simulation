import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div className={clsx(
      "bg-white rounded-xl shadow-soft border border-slate-200/60 p-6",
      "transition-all duration-200 hover:shadow-medium",
      className
    )}>
      {title && (
        <h3 className="text-lg font-semibold text-slate-900 mb-5 tracking-tight">{title}</h3>
      )}
      {children}
    </div>
  );
}

