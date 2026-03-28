import React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full rounded-xl px-3 py-2 text-sm transition-all',
          'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{
          backgroundColor: 'var(--bg-raised)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-strong)',
          ...style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
