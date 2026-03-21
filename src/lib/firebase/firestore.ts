import { db } from './config';
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, writeBatch, runTransaction } from 'firebase/firestore';
import { Task, DailyLog, LogStatus, Reward, Redemption } from '@/types';

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
  const logRef = doc(collection(db, 'logs'));
  
  let pointsAwarded = 0;
  if (status === 'done') pointsAwarded = taskPoints;
  else if (status === 'missed') pointsAwarded = -Math.floor(taskPoints / 2);

  const newLog: DailyLog = {
    id: logRef.id,
    userId,
    taskId,
    date,
    status,
    pointsAwarded
  };

  await runTransaction(db, async (transaction) => {
    // 1. Ensure log doesn't already exist for this date + task to prevent duplicate
    const q = query(collection(db, 'logs'), where('userId', '==', userId), where('taskId', '==', taskId), where('date', '==', date));
    const existingLogs = await getDocs(q); // Note: getDocs isn't strictly transacted here, but suffices for basic check
    if (!existingLogs.empty) throw new Error("Task already logged today.");

    // 2. Read User Profile
    const userRef = doc(db, 'users', userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found.");
    
    const userData = userSnap.data();
    let newTotalPoints = (userData.totalPoints || 0) + pointsAwarded;
    if (newTotalPoints < 0) newTotalPoints = 0; // Prevent negative points

    // 3. Write updates
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
