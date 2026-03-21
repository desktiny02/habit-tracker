import { db } from './config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, runTransaction, writeBatch } from 'firebase/firestore';
import { Task, DailyLog, LogStatus, Reward, Redemption, UserData, PRIORITY_CONFIG } from '@/types';
import { format, subDays, startOfWeek, addWeeks } from 'date-fns';

// ── Reserved usernames ────────────────────────────────────────────
const RESERVED_USERNAMES = new Set(['admin', 'support', 'system', 'moderator', 'root', 'api', 'help', 'info', 'contact', 'security']);

export const normalizeUsername = (raw: string): string =>
  raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');

export const isUsernameAvailable = async (username: string): Promise<{ available: boolean; reason?: string }> => {
  const normalized = normalizeUsername(username);
  if (normalized.length < 2) return { available: false, reason: 'Too short (min 2 chars)' };
  if (RESERVED_USERNAMES.has(normalized)) return { available: false, reason: 'Username is reserved' };
  const docRef = doc(db, 'usernames', normalized);
  const snap = await getDoc(docRef);
  if (snap.exists()) return { available: false, reason: 'Already taken' };
  return { available: true };
};

export const lookupEmailByUsername = async (username: string): Promise<string | null> => {
  const normalized = normalizeUsername(username);
  const snap = await getDoc(doc(db, 'usernames', normalized));
  if (!snap.exists()) return null;
  return snap.data().email as string;
};

export const createUserProfile = async (uid: string, email: string, username: string): Promise<void> => {
  const normalized = normalizeUsername(username);
  const userRef = doc(db, 'users', uid);
  const usernameRef = doc(db, 'usernames', normalized);

  // Calculate next Monday for skip token reset
  const now = new Date();
  const nextMonday = format(addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');

  await runTransaction(db, async (tx) => {
    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists()) throw new Error('Username was taken — please choose a different one.');

    const profile: UserData = {
      id: uid,
      email,
      username: normalized,
      totalPoints: 0,
      streakCount: 0,
      skipTokens: 3,
      skipTokensResetAt: nextMonday,
      createdAt: Date.now(),
    };
    tx.set(userRef, profile);
    tx.set(usernameRef, { uid, email, username: normalized });
  });
};

// ── Skip token reset check ──────────────────────────────────────
export const checkAndResetSkipTokens = async (userId: string): Promise<void> => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const userRef = doc(db, 'users', userId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as UserData;

    if (todayStr >= (data.skipTokensResetAt || '')) {
      const nextMonday = format(addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');
      tx.update(userRef, { skipTokens: 3, skipTokensResetAt: nextMonday });
    }
  });
};

// ── Tasks ────────────────────────────────────────────────────────
export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
  const trimmedName = task.name.trim();
  if (!trimmedName) throw new Error('Task name cannot be empty');
  if (trimmedName.length > 100) throw new Error('Task name too long (max 100 chars)');
  if (task.points > 1000) throw new Error('Points cannot exceed 1000');

  const taskRef = doc(collection(db, 'tasks'));
  const newTask: Task = {
    ...task,
    name: trimmedName,
    description: task.description?.trim() || '',
    id: taskRef.id,
    createdAt: Date.now()
  };
  await setDoc(taskRef, newTask);
  return newTask;
};

export const getUserTasks = async (userId: string) => {
  const q = query(collection(db, 'tasks'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as Task);
};

export const deleteTask = async (taskId: string) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'tasks', taskId));
};

// ── Penalty helper ──────────────────────────────────────────────
const calcPenalty = (task: { points: number; priority?: string; required?: boolean }): number => {
  const pri = (task.priority || 'medium') as keyof typeof PRIORITY_CONFIG;
  const multiplier = PRIORITY_CONFIG[pri]?.missMultiplier ?? 0.5;
  const base = Math.floor(task.points * multiplier);
  // Required tasks get 50% extra penalty
  return task.required ? Math.floor(base * 1.5) : base;
};

// ── Daily Logs & Points ─────────────────────────────────────────
export const logDailyTask = async (
  userId: string,
  taskId: string,
  taskName: string,
  status: LogStatus,
  task: Task,
  date: string
) => {
  const logId = `${userId}_${taskId}_${date}`;
  const logRef = doc(db, 'logs', logId);

  let pointsAwarded = 0;
  if (status === 'done') pointsAwarded = task.points;
  else if (status === 'missed') pointsAwarded = -calcPenalty(task);
  // skipped = 0 pts but costs a token

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

    // Skip token consumption
    let newSkipTokens = userData.skipTokens ?? 3;
    if (status === 'skipped') {
      if (newSkipTokens <= 0) throw new Error('No skip tokens left this week.');
      newSkipTokens -= 1;
    }

    // Streak: only 'done' advances. Missing a REQUIRED task resets. Skip is neutral.
    let newStreak = userData.streakCount || 0;
    if (status === 'done') {
      newStreak += 1;
    } else if (status === 'missed' && task.required) {
      newStreak = 0;
    }

    transaction.set(logRef, newLog);
    transaction.update(userRef, {
      totalPoints: newTotalPoints,
      streakCount: newStreak,
      skipTokens: newSkipTokens,
    });
  });

  return newLog;
};

// ── Auto-miss pending tasks ─────────────────────────────────────
export const autoMissPendingTasks = async (
  userId: string,
  tasks: Task[],
  date: string
): Promise<number> => {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();

  const scheduledTasks = tasks.filter((t) => {
    if (t.repeatType === 'daily') return true;
    if (t.repeatType === 'weekly') return t.repeatDays?.includes(dayOfWeek) ?? false;
    if (t.repeatType === 'once') return t.targetDate === date;
    return false;
  });

  if (scheduledTasks.length === 0) return 0;

  const q = query(
    collection(db, 'logs'),
    where('userId', '==', userId),
    where('date', '==', date)
  );
  const logSnaps = await getDocs(q);
  const alreadyLogged = new Set(logSnaps.docs.map((d) => d.data().taskId as string));

  const pending = scheduledTasks.filter((t) => !alreadyLogged.has(t.id));
  if (pending.length === 0) return 0;

  let totalPenalty = 0;
  const batch = writeBatch(db);
  let hadRequiredMiss = false;

  for (const task of pending) {
    const logId = `${userId}_${task.id}_${date}`;
    const penalty = -calcPenalty(task);
    totalPenalty += penalty;
    if (task.required) hadRequiredMiss = true;

    const newLog: DailyLog = {
      id: logId, userId, taskId: task.id, taskName: task.name,
      date, status: 'missed', pointsAwarded: penalty,
    };
    batch.set(doc(db, 'logs', logId), newLog);
  }

  await batch.commit();

  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data() as UserData;
    let newPoints = (userData.totalPoints || 0) + totalPenalty;
    if (newPoints < 0) newPoints = 0;
    const newStreak = hadRequiredMiss ? 0 : (userData.streakCount || 0);
    tx.update(userRef, { totalPoints: newPoints, streakCount: newStreak });
  });

  return pending.length;
};

// ── Rewards ──────────────────────────────────────────────────────
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
      id: redemptionRef.id, userId,
      rewardId: reward.id, rewardName: reward.name,
      date: new Date().toISOString(),
      status: 'unused', pointsSpent: reward.cost
    };

    transaction.set(redemptionRef, redemption);
    transaction.update(userRef, { totalPoints: userData.totalPoints - reward.cost });
  });
};

export const useCoupon = async (redemptionId: string) => {
  await updateDoc(doc(db, 'redemptions', redemptionId), { status: 'used' });
};
