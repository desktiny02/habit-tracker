'use client';

import { useAuth } from '@/lib/firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Gift, Calendar as CalendarIcon, LogOut, History as HistoryIcon, BarChart3, HelpCircle, Sun, Moon, StickyNote } from 'lucide-react';
import { auth, db } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    setMounted(true);
  }, []);
  const [username, setUsername] = useState('User');
  const [bkkTime, setBkkTime] = useState('');

  useEffect(() => {
    if (userData) setUsername(userData.username || 'User');
  }, [userData]);

  useEffect(() => {
    const tick = () => {
      const bkk = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Bangkok',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
        month: 'short',
        day: 'numeric',
      }).format(new Date());
      setBkkTime(bkk);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (!mounted || loading || !user) {
    return (
      <div
        className="flex-1 flex items-center justify-center min-h-screen"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div
          className="w-9 h-9 rounded-full border-[3px] animate-spin"
          style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Upcoming',  href: '/upcoming', icon: CalendarIcon },
    { name: 'Rewards',   href: '/rewards',  icon: Gift },
    { name: 'Calendar',  href: '/calendar', icon: CalendarIcon },
    { name: 'History',   href: '/history',  icon: HistoryIcon },
    { name: 'Scratchpad',href: '/scratchpad',icon: StickyNote },
    { name: 'Summary',   href: '/summary',  icon: BarChart3 },
    { name: 'Guide',     href: '/guide',    icon: HelpCircle },
  ];

  return (
    <div
      className="flex min-h-screen w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* ── Sidebar (desktop) ─────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80 group">
            {/* Logomark — gradient diamond with checkmark */}
            <div className="shrink-0 w-8 h-8">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6366f1"/>
                    <stop offset="100%" stopColor="#8b5cf6"/>
                  </linearGradient>
                  <linearGradient id="logoGradHover" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#818cf8"/>
                    <stop offset="100%" stopColor="#a78bfa"/>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                {/* Rounded square bg */}
                <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logoGrad)" opacity="0.15"/>
                <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none"/>
                {/* Checkmark */}
                <path d="M9 16.5L13.5 21L23 11" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
              </svg>
            </div>
            {/* Wordmark */}
            <div className="flex flex-col -space-y-0.5">
              <span className="text-[15px] font-extrabold tracking-tight leading-none" style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>HabitOS</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Daily Tracker</span>
            </div>
          </Link>
          <div className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            BKK: {bkkTime}
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 mb-3">
          <div className="flex items-center gap-2.5 bg-[var(--bg-raised)] p-2.5 rounded-xl border border-[var(--border)]">
            <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate text-[var(--text-primary)]">@{username}</p>
              <p className="text-[9px] text-[var(--text-muted)] font-medium">Tracking active</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
                style={{
                  backgroundColor: isActive ? 'var(--accent-subtle)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <item.icon className="w-4.5 h-4.5 shrink-0" style={{ width: 18, height: 18 }} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out & Theme Toggle */}
        <div className="p-3 pb-6 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark';
              setTheme(next);
              document.documentElement.setAttribute('data-theme', next);
              localStorage.setItem('theme', next);
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-150 hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            {theme === 'dark' ? <Sun style={{ width: 18, height: 18 }} /> : <Moon style={{ width: 18, height: 18 }} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-150 hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogOut style={{ width: 18, height: 18 }} className="shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-y-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-4xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 flex justify-between px-1 py-1.5 z-50"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center gap-1 p-1 flex-1 min-w-0 transition-all duration-150"
              style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-medium leading-none truncate w-full text-center">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
