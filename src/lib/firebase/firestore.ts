import { db } from './config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, writeBatch, runTransaction } from 'firebase/firestore';
import { Task, DailyLog, LogStatus, Reward, Redemption, UserData } from '@/types';

// ── Reserved usernames ────────────────────────────────────────────
const RESERVED_USERNAMES = new Set(['admin', 'support', 'system', 'moderator', 'root', 'api', 'help', 'info', 'contact', 'security']);

/**
 * Normalize a username: lowercase, trim, strip disallowed chars.
 */
export const normalizeUsername = (raw: string): string =>
  raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

/**
 * Check if a username is already taken. Returns true if available.
 */
export const isUsernameAvailable = async (username: string): Promise<{ available: boolean; reason?: string }> => {
  const normalized = normalizeUsername(username);
  if (normalized.length < 2) return { available: false, reason: 'Too short (min 2 chars)' };
  if (RESERVED_USERNAMES.has(normalized)) return { available: false, reason: 'Username is reserved' };
  const docRef = doc(db, 'usernames', normalized);
  const snap = await getDoc(docRef);
  if (snap.exists()) return { available: false, reason: 'Already taken' };
  return { available: true };
};

/**
 * Given a username, return the stored email for Firebase Auth sign-in.
 * Returns null if not found.
 */
export const lookupEmailByUsername = async (username: string): Promise<string | null> => {
  const normalized = normalizeUsername(username);
  const docRef = doc(db, 'usernames', normalized);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data().email as string;
};

/**
 * Create the user profile document and the username lookup document.
 */
export const createUserProfile = async (uid: string, email: string, username: string): Promise<void> => {
  const normalized = normalizeUsername(username);
  const userRef = doc(db, 'users', uid);
  const usernameRef = doc(db, 'usernames', normalized);

  await runTransaction(db, async (tx) => {
    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists()) throw new Error('Username was taken by another user — please choose a different one.');

    const profile: UserData = {
      id: uid,
      email,
      username: normalized,
      totalPoints: 0,
      streakCount: 0,
      createdAt: Date.now(),
    };
    tx.set(userRef, profile);
    tx.set(usernameRef, { uid, email, username: normalized });
  });
};

// Tasks
export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
  const taskRef = doc(collection(db, 'tasks'));
  const newTask: Task = {
    ...task,
    id: taskRef.id,
    createdAt: Date.now()
  };
  await setDoc(taskRef, newTask);
  return newTask;
};

export const getUserTasks = async (userId: string) => {
  const q = query(collection(db, 'tasks'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Task);
};

// Daily Logs & Points Logic
export const logDailyTask = async (userId: string, taskId: string, status: LogStatus, taskPoints: number, date: string) => {
  const logId = `${userId}_${taskId}_${date}`;
  const logRef = doc(db, 'logs', logId);
  
  let pointsAwarded = 0;
  if (status === 'done') pointsAwarded = taskPoints;
  else if (status === 'missed') pointsAwarded = -Math.floor(taskPoints / 2);

  const newLog: DailyLog = {
    id: logId,
    userId,
    taskId,
    date,
    status,
    pointsAwarded
  };

  await runTransaction(db, async (transaction) => {
    const existingLogSnap = await transaction.get(logRef);
    if (existingLogSnap.exists()) throw new Error("Task already logged today.");

    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");
    
    const userData = userSnap.data();
    let newTotalPoints = (userData.totalPoints || 0) + pointsAwarded;
    if (newTotalPoints < 0) newTotalPoints = 0; // Prevent negative points

    transaction.set(logRef, newLog);
    transaction.update(userRef, { totalPoints: newTotalPoints });
  });

  return newLog;
};

// Rewards
export const createReward = async (reward: Omit<Reward, 'id'>) => {
  const rewardRef = doc(collection(db, 'rewards'));
  const newReward = { ...reward, id: rewardRef.id };
  await setDoc(rewardRef, newReward);
  return newReward;
};

export const redeemReward = async (userId: string, reward: Reward) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");

    const userData = userSnap.data();
    if ((userData.totalPoints || 0) < reward.cost) {
      throw new Error("Insufficient points");
    }

    const redemptionRef = doc(collection(db, 'redemptions'));
    const redemption: Redemption = {
      id: redemptionRef.id,
      userId,
      rewardId: reward.id,
      date: new Date().toISOString(),
      pointsSpent: reward.cost
    };

    transaction.set(redemptionRef, redemption);
    transaction.update(userRef, { totalPoints: userData.totalPoints - reward.cost });
  });
};
