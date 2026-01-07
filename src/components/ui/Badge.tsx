import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface BadgeProps {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold tracking-wide",
        {
          "bg-emerald-50 text-emerald-700 border border-emerald-200/60": variant === 'success',
          "bg-amber-50 text-amber-700 border border-amber-200/60": variant === 'warning',
          "bg-red-50 text-red-700 border border-red-200/60": variant === 'danger',
          "bg-primary-50 text-primary-700 border border-primary-200/60": variant === 'info',
          "bg-slate-100 text-slate-700 border border-slate-200/60": variant === 'default',
        }
      )}
    >
      {children}
    </span>
  );
}

