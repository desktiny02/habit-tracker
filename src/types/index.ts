// User Types
export interface UserData {
  id: string;
  email: string;
  username: string;
  totalPoints: number;
  streakCount: number;
  skipTokens: number;       // 3 per week, resets Monday 00:00
  skipTokensResetAt: string; // ISO Monday date for next reset
  createdAt: number;
}

// Task Types
export type RepeatType = 'daily' | 'weekly' | 'once';
export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  userId: string;
  name: string;
  description?: string;
  points: number;
  priority: Priority;
  required: boolean;    // Required tasks affect streak
  repeatType: RepeatType;
  repeatDays?: number[];
  targetDate?: string;
  createdAt: number;
}

// Log Types
export type LogStatus = 'done' | 'missed' | 'skipped';

export interface DailyLog {
  id: string;
  userId: string;
  taskId: string;
  taskName?: string;
  date: string;
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
  rewardName?: string;
  date: string;
  status?: 'unused' | 'used';
  pointsSpent: number;
}

// Priority helpers
export const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  missMultiplier: 1.0 },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', missMultiplier: 0.5 },
  low:    { label: 'Low',    color: '#64748b', bg: 'rgba(100,116,139,0.12)', missMultiplier: 0.3 },
} as const;
