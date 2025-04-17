export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  isCompleted?: boolean;
  isPostponed?: boolean;
  postponedCount?: number;
  createdAt?: string;
  completedAt?: string | null;
  postponedAt?: string | null;
}

// Tasks organized by date
export type TasksByDate = Record<string, Task[]>;
