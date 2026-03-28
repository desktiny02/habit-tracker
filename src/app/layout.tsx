import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/firebase/auth';
import { Toaster } from 'react-hot-toast';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Habit Tracker — Build Better Habits',
  description:
    'Track your daily habits, earn points, and redeem rewards. A modern, gamified habit tracking app.',
  keywords: ['habit tracker', 'productivity', 'rewards', 'daily tasks', 'habit building'],
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
      >
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-center"
            toastOptions={{
              duration: 3500,
              style: {
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontWeight: 500,
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
