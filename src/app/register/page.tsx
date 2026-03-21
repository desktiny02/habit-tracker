'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import {
  isUsernameAvailable,
  normalizeUsername,
  createUserProfile,
} from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckSquare, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [usernameReason, setUsernameReason] = useState('');
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time username availability check
  useEffect(() => {
    const raw = username;
    if (!raw) { setUsernameStatus('idle'); return; }

    const normalized = normalizeUsername(raw);
    if (normalized.length < 2) {
      setUsernameStatus('invalid');
      setUsernameReason('Min 2 characters');
      return;
    }

    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await isUsernameAvailable(normalized);
        if (result.available) {
          setUsernameStatus('available');
          setUsernameReason('');
        } else {
          setUsernameStatus('taken');
          setUsernameReason(result.reason || 'Not available');
        }
      } catch (err: any) {
        setUsernameStatus('invalid');
        const msg = err.code === 'permission-denied' ? 'Permission denied (Refresh page)' : 'Error checking availability';
        setUsernameReason(msg);
        console.error('Username check error:', err);
      }
    }, 450);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [username]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameStatus !== 'available') {
      toast.error(usernameReason || 'Please choose a valid, available username.');
      return;
    }
    setLoading(true);
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
      try {
        await createUserProfile(credential.user.uid, email, username);
        toast.success('Account created! Welcome 🎉');
        router.push('/');
      } catch (profileError: any) {
        // Rollback on profile creation failure to prevent orphaned auth accounts
        await credential.user.delete().catch(() => {});
        const msg = profileError.code === 'permission-denied' 
          ? 'Database permission denied. (Try refreshing the page)' 
          : profileError.message || 'Failed to initialize profile.';
        toast.error(msg);
        setLoading(false);
      }
    } catch (error: any) {
      let msg = error.message || 'Failed to create account.';
      if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please sign in.';
      else if (error.code === 'auth/invalid-email') msg = 'Invalid email address format.';
      else if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters.';
      else if (error.code === 'auth/network-request-failed') msg = 'Network connection failed.';
      
      toast.error(msg);
      setLoading(false);
    }
  };

  // Username status indicator
  const UsernameIndicator = () => {
    if (usernameStatus === 'idle') return null;
    if (usernameStatus === 'checking') return (
      <Loader2
        className="animate-spin"
        style={{ color: 'var(--text-muted)', width: 15, height: 15 }}
      />
    );
    if (usernameStatus === 'available') return (
      <CheckCircle2 style={{ color: 'var(--success)', width: 15, height: 15 }} />
    );
    return (
      <XCircle style={{ color: 'var(--danger)', width: 15, height: 15 }} />
    );
  };

  const usernameStatusText = () => {
    if (usernameStatus === 'checking') return 'Checking…';
    if (usernameStatus === 'available') return `@${normalizeUsername(username)} is available`;
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return usernameReason;
    return '';
  };

  const statusColor = () => {
    if (usernameStatus === 'available') return 'var(--success)';
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') return 'var(--danger)';
    return 'var(--text-muted)';
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
              Create account
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Start your habit tracking journey
            </p>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Username */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              htmlFor="username"
              style={{ color: 'var(--text-secondary)' }}
            >
              Username
            </label>
            <div className="relative">
              <Input
                id="username"
                type="text"
                placeholder="yourname"
                value={username}
                autoComplete="username"
                minLength={2}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              {username && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <UsernameIndicator />
                </span>
              )}
            </div>
            {usernameStatusText() && (
              <p
                className="text-xs mt-1.5"
                style={{ color: statusColor() }}
              >
                {usernameStatusText()}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              htmlFor="reg-email"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email
              <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
                (for account recovery)
              </span>
            </label>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              htmlFor="reg-password"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
              <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
                (min 6 chars)
              </span>
            </label>
            <Input
              id="reg-password"
              type="password"
              placeholder="••••••••"
              value={password}
              autoComplete="new-password"
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            id="register-submit"
            type="submit"
            className="w-full mt-2"
            size="lg"
            disabled={loading || usernameStatus === 'checking' || usernameStatus === 'taken' || usernameStatus === 'invalid'}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium transition-opacity hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
