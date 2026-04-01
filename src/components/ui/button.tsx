import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', style, ...props }, ref) => {
    const variantStyle: React.CSSProperties = (() => {
      switch (variant) {
        case 'primary':
          return {
            background: 'linear-gradient(135deg, #7c6ef5, #5a6ef0)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(124,110,245,0.3)',
          };
        case 'secondary':
          return {
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
          };
        case 'outline':
          return {
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
          };
        case 'ghost':
          return {
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
          };
        case 'danger':
          return {
            backgroundColor: 'var(--danger)',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(240,82,110,0.25)',
          };
        default:
          return {};
      }
    })();

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.97]',
          'hover:opacity-90',
          {
            'shadow-sm': variant === 'primary' || variant === 'danger',
            'h-9 px-4 text-sm gap-1.5': size === 'sm',
            'h-10 px-5 text-sm gap-2': size === 'md',
            'h-12 px-7 text-sm rounded-2xl gap-2': size === 'lg',
          },
          className
        )}
        style={{ ...variantStyle, ...style }}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
