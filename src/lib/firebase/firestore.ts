import { db } from './config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, runTransaction, writeBatch, deleteDoc } from 'firebase/firestore';
import { Task, DailyLog, LogStatus, Reward, Redemption, UserData, PRIORITY_CONFIG, ScheduledNotification } from '@/types';

// ── Notification Helpers ─────────────────────────────────────
export const syncScheduledNotifications = async (task: Task) => {
  if (!task.userId) return;

  // Clear existing pending notifications for this task
  const q = query(
    collection(db, 'scheduled_notifications'),
    where('taskId', '==', task.id),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();

  if (!task.time) return;

  // Determine date to schedule for (simplified: current or relative today/tomorrow based on targetDate/recurrence)
  // For 'once' tasks, use targetDate. For repeating, use today. 
  const taskDate = task.repeatType === 'once' ? task.targetDate : new Date().toISOString().split('T')[0];
  if (!taskDate) return;

  const [hours, minutes] = task.time.split(':').map(Number);
  const scheduledDateTime = new Date(`${taskDate}T${task.time}:00`);
  const now = Date.now();

  const notificationsToSend: Omit<ScheduledNotification, 'id'>[] = [];

  // Standard (1h before)
  const notifyAtStandard = scheduledDateTime.getTime() - (60 * 60 * 1000);
  if (notifyAtStandard > now) {
    notificationsToSend.push({
      userId: task.userId,
      taskId: task.id,
      taskName: task.name,
      type: 'standard',
      notifyAt: notifyAtStandard,
      status: 'pending',
      scheduledTime: task.time
    });
  }

  // Priority (10m before)
  if (task.required && task.priority === 'high') {
    const notifyAtPriority = scheduledDateTime.getTime() - (10 * 60 * 1000);
    if (notifyAtPriority > now) {
      notificationsToSend.push({
        userId: task.userId,
        taskId: task.id,
        taskName: task.name,
        type: 'priority',
        notifyAt: notifyAtPriority,
        status: 'pending',
        priority: task.priority,
        scheduledTime: task.time
      });
    }
  }

  for (const n of notificationsToSend) {
    const nRef = doc(collection(db, 'scheduled_notifications'));
    await setDoc(nRef, { ...n, id: nRef.id });
  }
};

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

export const createUserProfile = async (uid: string, email: string, username: string, code: string): Promise<void> => {
  const normalized = normalizeUsername(username);
  const userRef = doc(db, 'users', uid);
  const usernameRef = doc(db, 'usernames', normalized);
  const codeRef = doc(db, 'registration_codes', code);

  await runTransaction(db, async (tx) => {
    // Check username
    const usernameSnap = await tx.get(usernameRef);
    if (usernameSnap.exists()) throw new Error('Username was taken — please choose a different one.');

    // Check registration code
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists()) throw new Error('Invalid registration code.');
    if (codeSnap.data()?.used === true) throw new Error('This registration code has already been used.');

    const profile: UserData = {
      id: uid,
      email,
      username: normalized,
      totalPoints: 0,
      createdAt: Date.now(),
    };
    
    // Update collections
    tx.set(userRef, profile);
    tx.set(usernameRef, { uid, email, username: normalized });
    tx.update(codeRef, {
      used: true,
      usedBy: uid,
      usedAt: new Date().toISOString()
    });
  });
};

// ── Tasks / Events ────────────────────────────────────────────────────────
export const createTask = async (task: Omit<Task, 'id' | 'createdAt'>) => {
  const trimmedName = task.name.trim();
  if (!trimmedName) throw new Error('Item name cannot be empty');
  if (trimmedName.length > 100) throw new Error('Item name too long (max 100 chars)');
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
  await syncScheduledNotifications(newTask).catch(console.error);
  return newTask;
};

export const updateTask = async (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'userId'>>) => {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, updates);
  
  const snap = await getDoc(taskRef);
  if (snap.exists()) {
    await syncScheduledNotifications(snap.data() as Task).catch(console.error);
  }
};

export const getUserTasks = async (userId: string) => {
  const q = query(collection(db, 'tasks'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as Task);
};

export const deleteTask = async (taskId: string, userId?: string) => {
  const { deleteDoc, writeBatch } = await import('firebase/firestore');
  
  // Also delete all logs and notifications associated with this task
  if (userId) {
    const qLogs = query(collection(db, 'logs'), where('userId', '==', userId), where('taskId', '==', taskId));
    const qNotifs = query(collection(db, 'scheduled_notifications'), where('taskId', '==', taskId));
    const [logsSnap, notifsSnap] = await Promise.all([getDocs(qLogs), getDocs(qNotifs)]);
    
    let pointsOffset = 0;
    const batch = writeBatch(db);
    
    for (const d of logsSnap.docs) {
      const data = d.data() as DailyLog;
      pointsOffset -= data.pointsAwarded || 0; 
      batch.delete(d.ref);
    }

    for (const d of notifsSnap.docs) {
      batch.delete(d.ref);
    }
    
    // Delete the task itself
    batch.delete(doc(db, 'tasks', taskId));
    
    // Apply points offset
    if (pointsOffset !== 0) {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
         const currentPoints = (userSnap.data() as UserData).totalPoints || 0;
         batch.update(userRef, { totalPoints: Math.max(0, currentPoints + pointsOffset) });
      }
    }
    
    await batch.commit();
  } else {
    await deleteDoc(doc(db, 'tasks', taskId));
  }
};

// Cancel an event/task. If recurring, we might want to delete it or disable it.
// The user says "If recurring task is cancelled -> must NOT appear from that day onward".
// "If future task/event is cancelled -> removed from all views"
// Since recurring tasks don't currently have a cancel date, we can either set a `endDate` 
// or simply delete the task if we want it fully removed. The prompt says "removed from all views".
// Let's implement real deletion for tasks.
export const cancelRecurringTask = deleteTask;

// ── Penalty helper ──────────────────────────────────────────────
const calcPenalty = (task: { points: number; priority?: string; required?: boolean; itemType?: string }): number => {
  if (task.itemType === 'event') return 0;
  const pri = (task.priority || 'medium') as keyof typeof PRIORITY_CONFIG;
  const multiplier = PRIORITY_CONFIG[pri]?.missMultiplier ?? 0.5;
  const base = Math.floor((task.points || 0) * multiplier);
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
  if (task.itemType !== 'event') {
    if (status === 'done') {
      pointsAwarded = task.points;
      // Streak Multiplier: +5% per current streak day (max 2x total multiplier)
      if (task.repeatType === 'daily') {
        const streak = task.currentStreak || 0;
        const multiplier = Math.min(2, 1 + (streak * 0.05));
        pointsAwarded = Math.round(pointsAwarded * multiplier);
      }
    } else if (status === 'missed') {
      pointsAwarded = -calcPenalty(task);
    }
  }

  const newLog: DailyLog = { 
    id: logId, 
    userId, 
    taskId, 
    taskName, 
    itemType: task.itemType,
    date, 
    status, 
    pointsAwarded,
    createdAt: Date.now() 
  };

  await runTransaction(db, async (transaction) => {
    const existingLogSnap = await transaction.get(logRef);
    if (existingLogSnap.exists()) {
      throw new Error('Item already logged for this date.');
    }

    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    
    let currentPoints = 0;
    if (userSnap.exists()) {
      const uData = userSnap.data() as UserData;
      currentPoints = uData.totalPoints || 0;
    }

    let newTotalPoints = currentPoints + pointsAwarded;
    if (newTotalPoints < 0) newTotalPoints = 0;
    
    transaction.set(logRef, newLog);
    
    if (userSnap.exists()) {
      transaction.update(userRef, { totalPoints: newTotalPoints });
    } else {
      // Auto-create missing profile silently
      const fallbackUsername = 'User'; 
      const newProfile: UserData = {
        id: userId,
        email: '', 
        username: fallbackUsername,
        totalPoints: newTotalPoints,
        createdAt: Date.now(),
      };
      transaction.set(userRef, newProfile, { merge: true });
    }
    
    // Update Streak for Daily tasks
    if (task.itemType !== 'event' && task.repeatType === 'daily') {
      const taskRef = doc(db, 'tasks', taskId);
      if (status === 'done') {
        const newStreak = (task.currentStreak || 0) + 1;
        transaction.update(taskRef, { currentStreak: newStreak });
      } else if (status === 'missed') {
        transaction.update(taskRef, { currentStreak: 0 });
      }
    }
  });

  return newLog;
};

export const deleteDailyLog = async (userId: string, logId: string) => {
  const logRef = doc(db, 'logs', logId);
  
  await runTransaction(db, async (transaction) => {
    const logSnap = await transaction.get(logRef);
    if (!logSnap.exists()) throw new Error('Log not found.');

    const logData = logSnap.data() as DailyLog;
    const pointsAwarded = logData.pointsAwarded || 0;

    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data() as UserData;
      let newTotalPoints = (userData.totalPoints || 0) - pointsAwarded;
      if (newTotalPoints < 0) newTotalPoints = 0;
      transaction.update(userRef, { totalPoints: newTotalPoints });
    }

    transaction.delete(logRef);
  });
};

// ── Auto-miss pending tasks ─────────────────────────────────────
export const autoMissPendingTasks = async (
  userId: string,
  tasks: Task[],
  date: string
): Promise<number> => {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();

  // Only auto-miss TASKS — events have no points and should not be auto-missed
  const scheduledTasks = tasks.filter((t) => {
    if (t.itemType === 'event') return false;
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

  for (const task of pending) {
    const logId = `${userId}_${task.id}_${date}`;
    const penalty = -calcPenalty(task);
    totalPenalty += penalty;

    const newLog: DailyLog = {
      id: logId, 
      userId, 
      taskId: task.id, 
      taskName: task.name,
      itemType: task.itemType,
      date, 
      status: 'missed', 
      pointsAwarded: penalty,
      createdAt: Date.now()
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
    tx.update(userRef, { totalPoints: newPoints });
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

export const deleteReward = async (rewardId: string) => {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'rewards', rewardId));
};

export const redeemReward = async (userId: string, reward: Reward) => {
  await runTransaction(db, async (transaction) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    
    let currentPoints = 0;
    if (userSnap.exists()) {
      currentPoints = (userSnap.data() as UserData).totalPoints || 0;
    }

    if (currentPoints < reward.cost) {
      throw new Error(userSnap.exists() ? 'Insufficient points' : 'Insufficient points (Profile not found)');
    }


    const redemptionRef = doc(collection(db, 'redemptions'));
    const redemption: Redemption = {
      id: redemptionRef.id, userId,
      rewardId: reward.id, rewardName: reward.name,
      date: new Date().toISOString(),
      status: 'unused', pointsSpent: reward.cost
    };

    transaction.set(redemptionRef, redemption);
    transaction.update(userRef, { totalPoints: currentPoints - reward.cost });
  });
};

export const useCoupon = async (redemptionId: string) => {
  await updateDoc(doc(db, 'redemptions', redemptionId), { status: 'used' });
};

// ── Daily Bonus ──────────────────────────────────────────────────
export const claimDailyLoginBonus = async (userId: string, todayStr: string) => {
  const userRef = doc(db, 'users', userId);
  const bonus = 1;

  let result = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as UserData;
    if (data.lastLoginDate === todayStr) return; // already claimed

    tx.update(userRef, {
      totalPoints: (data.totalPoints || 0) + bonus,
      lastLoginDate: todayStr
    });
    result = bonus;
  });
  return result;
};
