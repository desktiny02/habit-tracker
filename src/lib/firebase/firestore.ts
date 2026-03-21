import { db } from './config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, runTransaction, writeBatch } from 'firebase/firestore';
import { Task, DailyLog, LogStatus, Reward, Redemption, UserData } from '@/types';
import { format, subDays } from 'date-fns';

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
  const trimmedName = task.name.trim();
  if (!trimmedName) throw new Error('Task name cannot be empty');
  if (trimmedName.length > 100) throw new Error('Task name too long (max 100 chars)');
  if (task.points > 1000) throw new Error('Points cannot exceed 1000');

  const taskRef = doc(collection(db, 'tasks'));
  const newTask: Task = {
    ...task,
    name: trimmedName,
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

export const deleteTask = async (taskId: string) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'tasks', taskId));
};

// Daily Logs & Points Logic
export const logDailyTask = async (
  userId: string,
  taskId: string,
  taskName: string,
  status: LogStatus,
  taskPoints: number,
  date: string
) => {
  const logId = `${userId}_${taskId}_${date}`;
  const logRef = doc(db, 'logs', logId);

  let pointsAwarded = 0;
  if (status === 'done') pointsAwarded = taskPoints;
  else if (status === 'missed') pointsAwarded = -Math.floor(taskPoints / 2);

  const newLog: DailyLog = { id: logId, userId, taskId, taskName, date, status, pointsAwarded };

  await runTransaction(db, async (transaction) => {
    const existingLogSnap = await transaction.get(logRef);
    if (existingLogSnap.exists()) throw new Error('Task already logged today.');

    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('User not found.');

    const userData = userSnap.data() as UserData;
    let newTotalPoints = (userData.totalPoints || 0) + pointsAwarded;
    if (newTotalPoints < 0) newTotalPoints = 0;

    // ── Streak logic ─────────────────────────────────────────────
    // Only 'done' advances the streak. 'missed'/'skipped' resets it to 0.
    let newStreak = userData.streakCount || 0;
    if (status === 'done') {
      newStreak += 1;
    } else if (status === 'missed') {
      // Missed resets the streak; skipped is neutral (preserves streak)
      newStreak = 0;
    }

    transaction.set(logRef, newLog);
    transaction.update(userRef, { totalPoints: newTotalPoints, streakCount: newStreak });
  });

  return newLog;
};

/**
 * Auto-miss all tasks for a given day that have NO existing log entry.
 * Called on dashboard load to handle any previous days where tasks were never acted upon.
 * Returns the number of tasks auto-missed.
 */
export const autoMissPendingTasks = async (
  userId: string,
  tasks: Task[],
  date: string          // YYYY-MM-DD of the day to close out
): Promise<number> => {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // noon to avoid DST edge

  // Which tasks were scheduled for that date?
  const scheduledTasks = tasks.filter((t) => {
    if (t.repeatType === 'daily') return true;
    if (t.repeatType === 'weekly') return t.repeatDays?.includes(dayOfWeek) ?? false;
    if (t.repeatType === 'once') return t.targetDate === date;
    return false;
  });

  if (scheduledTasks.length === 0) return 0;

  // Fetch existing logs for that date
  const q = query(
    collection(db, 'logs'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const logSnaps = await getDocs(q);
  const alreadyLogged = new Set(logSnaps.docs.map((d) => d.data().taskId as string));

  const pending = scheduledTasks.filter((t) => !alreadyLogged.has(t.id));
  if (pending.length === 0) return 0;

  // Use a batch to write all missed logs at once, then update points in a transaction
  let totalPenalty = 0;
  const batch = writeBatch(db);

  for (const task of pending) {
    const logId = `${userId}_${task.id}_${date}`;
    const penalty = -Math.floor(task.points / 2);
    totalPenalty += penalty;

    const newLog: DailyLog = {
      id: logId,
      userId,
      taskId: task.id,
      taskName: task.name,
      date,
      status: 'missed',
      pointsAwarded: penalty,
    };
    batch.set(doc(db, 'logs', logId), newLog);
  }

  await batch.commit();

  // Now update the user's totalPoints (and reset streak) in a transaction
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data() as UserData;
    let newPoints = (userData.totalPoints || 0) + totalPenalty;
    if (newPoints < 0) newPoints = 0;
    // Missing tasks resets streak
    tx.update(userRef, { totalPoints: newPoints, streakCount: 0 });
  });

  return pending.length;
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
    if (!userSnap.exists()) throw new Error('User not found');

    const userData = userSnap.data();
    if ((userData.totalPoints || 0) < reward.cost) {
      throw new Error('Insufficient points');
    }

    const redemptionRef = doc(collection(db, 'redemptions'));
    const redemption: Redemption = {
      id: redemptionRef.id,
      userId,
      rewardId: reward.id,
      rewardName: reward.name,
      date: new Date().toISOString(),
      status: 'unused',
      pointsSpent: reward.cost
    };

    transaction.set(redemptionRef, redemption);
    transaction.update(userRef, { totalPoints: userData.totalPoints - reward.cost });
  });
};

export const useCoupon = async (redemptionId: string) => {
  const ref = doc(db, 'redemptions', redemptionId);
  await updateDoc(ref, { status: 'used' });
};
