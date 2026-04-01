export interface UserData {
  id: string;
  email: string;
  username: string;
  totalPoints: number;
  createdAt: number;
  linePin?: string;
  lineUserId?: string;
  lastLoginDate?: string;
  deductionApplied?: boolean;
  timezone?: string;
  language?: string;
  telegramChatId?: string;
}

// Task Types
export type ItemType = 'task' | 'event';
export type RepeatType = 'daily' | 'weekly' | 'once';
export type Priority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  userId: string;
  itemType: ItemType;
  name: string;
  description?: string;
  points: number; // For events, this can be 0.
  priority: Priority;
  required: boolean;
  repeatType: RepeatType;
  repeatDays?: number[];
  targetDate?: string;
  time?: string; // HH:mm format
  createdAt: number;
  currentStreak?: number;
}

export interface ScheduledNotification {
  id: string;
  userId: string;
  taskId: string;
  taskName: string;
  description?: string;
  itemType: ItemType;
  type: 'standard' | 'priority'; // standard: 1h before, priority: 10m before
  notifyAt: number; // timestamp in ms
  status: 'pending' | 'sent' | 'failed';
  priority?: Priority;
  scheduledTime: string; // HH:mm
}

// Log Types
export type LogStatus = 'done' | 'missed' | 'skipped';

export interface DailyLog {
  id: string;
  userId: string;
  taskId: string;
  taskName?: string;
  itemType?: ItemType;
  date: string; // YYYY-MM-DD
  status: LogStatus;
  pointsAwarded: number;
  createdAt?: number; // adding timestamp to properly sort
}

// Reward Types
export interface Reward {
  id: string;
  userId: string;
  name: string;
  cost: number;
  category?: string;
}

export interface Redemption {
  id: string;
  userId: string;
  rewardId: string;
  rewardName?: string;
  date: string; // ISO string
  status?: 'unused' | 'used';
  pointsSpent: number;
}

// Priority helpers
export const PRIORITY_CONFIG = {
  high:   { label: 'High',   color: '#f0526e', bg: 'rgba(240,82,110,0.12)',  missMultiplier: 1.0 },
  medium: { label: 'Medium', color: '#7c6ef5', bg: 'rgba(124,110,245,0.12)', missMultiplier: 0.5 },
  low:    { label: 'Low',    color: '#2ecc8e', bg: 'rgba(46,204,142,0.1)',   missMultiplier: 0.3 },
} as const;
