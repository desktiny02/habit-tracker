'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './config';
import { doc, onSnapshot } from 'firebase/firestore';
import { UserData } from '@/types';

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubUser = () => {};

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      unsubUser(); // clear previous snapshot listener

      if (firebaseUser) {
        unsubUser = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
          if (snap.exists()) {
            setUserData(snap.data() as UserData);
          } else {
            setUserData(null);
          }
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      unsubUser();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
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
