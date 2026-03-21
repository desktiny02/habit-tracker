'use client';

import { useAuth } from '@/lib/firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, CheckSquare, Gift, Calendar as CalendarIcon, LogOut, History as HistoryIcon, BarChart3 } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
    { name: 'History',   href: '/history',  icon: HistoryIcon },
    { name: 'Summary',   href: '/summary',  icon: BarChart3 },
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
        <div className="px-6 pt-6 pb-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            <CheckSquare className="w-5 h-5" />
            Habit Tracker
          </Link>
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
        className="md:hidden fixed bottom-0 inset-x-0 flex justify-around px-2 py-2 z-50"
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
              className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-150"
              style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
