import type { SelectHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export function Select({ children, className, ...props }: SelectProps) {
  return (
    <select
      className={clsx(
        "w-full px-3.5 py-2.5 border border-slate-300 rounded-lg bg-white text-slate-900 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
        "transition-all duration-200 hover:border-slate-400",
        "disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

