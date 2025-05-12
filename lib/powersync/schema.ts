import { column, Schema, Table } from '@powersync/react-native';

// Define valid priority values
type Priority = 'high' | 'medium' | 'low';

// Define the tasks table structure
const tasks = new Table(
  {
    title: column.text,
    description: column.text,
    priority: column.text,
    created_at: column.text,
    completed_at: column.text,
    postponed_at: column.text,
    postponed_count: column.integer,
    creator_id: column.integer,
    category: column.text,
    is_completed: column.integer,
    is_postponed: column.integer,
  },
  { 
    indexes: { 
      priority_idx: ['priority'],
      creator_idx: ['creator_id'],
      status_idx: ['is_completed', 'is_postponed'],
      created_idx: ['created_at']
    } 
  }
);

// Create and export the schema
export const AppSchema = new Schema({
  tasks
});

// Export TypeScript types
export type Database = (typeof AppSchema)['types'];
export type TaskRecord = Database['tasks'];
