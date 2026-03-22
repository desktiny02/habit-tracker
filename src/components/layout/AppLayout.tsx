'use client';

import { useAuth } from '@/lib/firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, CheckSquare, Gift, Calendar as CalendarIcon, LogOut, History as HistoryIcon, BarChart3, HelpCircle, User as UserIcon } from 'lucide-react';
import { auth, db } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
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
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            <CheckSquare className="w-5 h-5" />
            Habit Tracker
          </Link>
          <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
            <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
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

        {/* Sign Out */}
        <div className="p-3 pb-6" style={{ borderTop: '1px solid var(--border)' }}>
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
