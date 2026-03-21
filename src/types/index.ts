// User Types
export interface UserData {
  id: string;
  totalPoints: number;
  streakCount: number;
}

// Task Types
export type RepeatType = 'daily';

export interface Task {
  id: string;
  userId: string;
  name: string;
  points: number;
  repeatType: RepeatType;
  createdAt: number;
}

// Log Types
export type LogStatus = 'done' | 'missed' | 'skipped';

export interface DailyLog {
  id: string;
  userId: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  status: LogStatus;
  pointsAwarded: number;
}

// Reward Types
export interface Reward {
  id: string;
  userId: string;
  name: string;
  cost: number;
}

export interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  date: string;
  pointsSpent: number;
}
