import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function Button({ children, variant = 'primary', className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        {
          "bg-[#0284c7] text-white shadow-medium hover:bg-[#0369a1] hover:shadow-large focus:ring-[#0ea5e9] disabled:bg-slate-400 disabled:text-slate-200 disabled:cursor-not-allowed disabled:hover:bg-slate-400 disabled:shadow-none": variant === 'primary',
          "bg-slate-100 text-slate-900 hover:bg-slate-200 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed": variant === 'secondary',
          "border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed": variant === 'outline',
        },
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

