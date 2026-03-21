import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', style, ...props }, ref) => {
    // Build inline style per variant to respect CSS variables
    const variantStyle: React.CSSProperties = (() => {
      switch (variant) {
        case 'primary':
          return {
            backgroundColor: 'var(--accent)',
            color: '#fff',
          };
        case 'secondary':
          return {
            backgroundColor: 'var(--bg-raised)',
            color: 'var(--text-primary)',
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
            backgroundColor: '#ef4444',
            color: '#fff',
          };
        default:
          return {};
      }
    })();

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
          'disabled:pointer-events-none disabled:opacity-50',
          'active:scale-[0.97]',
          // Hover handled via opacity tweak — works across all variants
          'hover:opacity-90',
          {
            'shadow-sm': variant === 'primary' || variant === 'danger',
            'h-9 px-4 text-sm': size === 'sm',
            'h-11 px-5 text-sm': size === 'md',
            'h-12 px-7 text-base rounded-2xl': size === 'lg',
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
