'use client';

import { useAuth } from '@/lib/firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Gift, Calendar as CalendarIcon, LogOut, History as HistoryIcon, BarChart3, HelpCircle, Sun, Moon, StickyNote, CalendarClock, Plus } from 'lucide-react';
import { auth, db } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [totalPoints, setTotalPoints] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
    setMounted(true);
  }, []);
  const [username, setUsername] = useState('User');
  const [bkkTime, setBkkTime] = useState('');

  useEffect(() => {
    if (userData) {
      setUsername(userData.username || 'User');
    }
  }, [userData]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) setTotalPoints(snap.data().totalPoints || 0);
    });
    return () => unsubscribe();
  }, [user]);

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
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-10 h-10 rounded-full border-[3px] animate-spin"
            style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }}
          />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>LOADING</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Upcoming',  href: '/upcoming', icon: CalendarClock },
    { name: 'Rewards',   href: '/rewards',  icon: Gift },
    { name: 'Calendar',  href: '/calendar', icon: CalendarIcon },
    { name: 'History',   href: '/history',  icon: HistoryIcon },
    { name: 'Scratchpad',href: '/scratchpad',icon: StickyNote },
    { name: 'Summary',   href: '/summary',  icon: BarChart3 },
    { name: 'Guide',     href: '/guide',    icon: HelpCircle },
  ];

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <div
      className="flex min-h-screen w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* ── Sidebar (desktop) ─────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-[220px] shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Logomark */}
            <div className="shrink-0 w-8 h-8">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#7c6ef5"/>
                    <stop offset="100%" stopColor="#5a6ef0"/>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="1.5" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#logoGrad)" opacity="0.18"/>
                <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#logoGrad)" strokeWidth="1.5" fill="none"/>
                <path d="M9 16.5L13.5 21L23 11" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
              </svg>
            </div>
            {/* Wordmark */}
            <div className="flex flex-col -space-y-0.5">
              <span className="text-[15px] font-extrabold tracking-tight leading-none" style={{
                background: 'linear-gradient(135deg, #7c6ef5, #5a6ef0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>HabitOS</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Daily Tracker</span>
            </div>
          </Link>

          {/* BKK time */}
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            BKK: {bkkTime}
          </div>
        </div>

        {/* User Card */}
        <div className="px-3 mb-4">
          <div
            className="flex items-center gap-2.5 p-2.5 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(124,110,245,0.1), rgba(90,110,240,0.06))',
              border: '1px solid rgba(124,110,245,0.18)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{
                background: 'linear-gradient(135deg, #7c6ef5, #5a6ef0)',
                boxShadow: '0 2px 8px rgba(124,110,245,0.35)',
              }}
            >
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>@{username}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(124,110,245,0.15)', color: 'var(--accent)' }}>
                  {totalPoints} pts
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={
                  isActive
                    ? {
                        background: 'linear-gradient(135deg, rgba(124,110,245,0.2), rgba(90,110,240,0.12))',
                        border: '1px solid rgba(124,110,245,0.3)',
                        color: '#a78bfa',
                      }
                    : {
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: 'var(--text-secondary)',
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    const target = e.currentTarget as HTMLElement;
                    target.style.borderColor = 'var(--border-dashed)';
                    target.style.color = 'var(--text-primary)';
                    target.style.background = 'rgba(124,110,245,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    const target = e.currentTarget as HTMLElement;
                    target.style.borderColor = 'transparent';
                    target.style.color = 'var(--text-secondary)';
                    target.style.background = 'transparent';
                  }
                }}
              >
                <item.icon style={{ width: 16, height: 16, flexShrink: 0 }} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* New Habit CTA */}
        <div className="px-3 pt-3">
          <Link
            href="/tasks/new"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #7c6ef5, #5a6ef0)',
              boxShadow: '0 4px 14px rgba(124,110,245,0.35)',
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            New Habit
          </Link>
        </div>

        {/* Bottom Controls */}
        <div className="p-3 pb-6 space-y-0.5 mt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            {theme === 'dark' ? <Sun style={{ width: 16, height: 16 }} /> : <Moon style={{ width: 16, height: 16 }} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>

          <button
            onClick={() => signOut(auth)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium w-full text-left transition-all duration-150"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <LogOut style={{ width: 16, height: 16, flexShrink: 0 }} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-y-auto pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* ── Mobile bottom nav ─────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 flex justify-between px-1 py-1.5 z-50"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -6px 24px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
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
              <item.icon style={{ width: 20, height: 20, flexShrink: 0 }} />
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
