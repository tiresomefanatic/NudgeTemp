export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  isCompleted?: boolean;
  isPostponed?: boolean;
  isArchived?: boolean;
  postponedCount?: number;
  createdAt?: string;
  completedAt?: string | null;
  postponedAt?: string | null;
  archivedAt?: string | null;
  creatorId?: number | null;
  category?: string | null;
}

// Tasks organized by date
export type TasksByDate = Record<string, Task[]>;

// Task participant roles
export type ParticipantRole = 'owner' | 'nudger';

// User data structure from Supabase
export interface UserData {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at?: string;
}

// Task participant
export interface TaskParticipant {
  id: number;
  task_id: string;
  user_id: number;
  role: ParticipantRole;
  joined_at?: string;
  user?: UserData | null;
}
