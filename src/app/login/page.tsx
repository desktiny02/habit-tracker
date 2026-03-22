'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { lookupEmailByUsername, normalizeUsername } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect } from 'react';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(''); // username or email
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Determine if the user typed an email address or a username
  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let email = identifier.trim();

      if (!isEmail(email)) {
        // username-based login: look up the email
        const found = await lookupEmailByUsername(email);
        if (!found) {
          toast.error('No account found for that username.');
          setLoading(false);
          return;
        }
        email = found;
      }

      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Welcome back!');
      router.push('/');
    } catch (error: any) {
      let msg = error.message || 'Failed to log in.';

      if (error.code === 'auth/invalid-credential') msg = 'Invalid username or password.';
      else if (error.code === 'auth/user-not-found') msg = 'No account found with this email.';
      else if (error.code === 'auth/wrong-password') msg = 'Incorrect password. Try again.';
      else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
      else if (error.code === 'auth/network-request-failed') msg = 'Network connection failed.';
      else if (error.code === 'permission-denied') msg = 'Permission denied (Refresh or check rules).';

      toast.error(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center min-h-screen p-4"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent-subtle)' }}
          >
            <CheckSquare style={{ color: 'var(--accent)', width: 24, height: 24 }} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Welcome back
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Sign in to continue tracking
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              htmlFor="identifier"
              style={{ color: 'var(--text-secondary)' }}
            >
              Username or Email
            </label>
            <Input
              id="identifier"
              type="text"
              placeholder="yourname or you@example.com"
              value={identifier}
              autoComplete="username"
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              htmlFor="password"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            id="login-submit"
            type="submit"
            className="w-full mt-2"
            size="lg"
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
