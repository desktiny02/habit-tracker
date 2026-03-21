'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './config';
import { doc, getDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <div className="min-h-full h-full flex flex-col">
        {loading ? (
          <div
            className="flex-1 flex items-center justify-center min-h-screen"
            style={{ backgroundColor: 'var(--bg-base)' }}
          >
            <div
              className="w-9 h-9 rounded-full border-[3px] animate-spin"
              style={{
                borderColor: 'var(--bg-raised)',
                borderTopColor: 'var(--accent)',
              }}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </AuthContext.Provider>
  );
}
