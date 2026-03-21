import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // base
          'flex h-11 w-full rounded-xl px-3 py-2 text-sm transition-all',
          // dark-mode colours via CSS vars
          'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{
          backgroundColor: 'var(--bg-raised)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-strong)',
          // @ts-ignore
          '--tw-ring-color': 'var(--accent)',
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
