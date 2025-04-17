import { powersync } from './database';
import { TaskRecord } from './schema';
import { useEffect, useState } from 'react';
import { Task } from '@/types/task';
// Not using useQuery since we need more control over the watch pattern

// Configuration
const POLL_INTERVAL_MS = 2000; // 2 seconds
const DEFAULT_PRIORITY = 'medium' as const;

// Convert PowerSync record to app Task type
// Function to generate UUID that's compatible with Supabase
function generateUUID(): string {
  // Implementation based on RFC4122 version 4
  const hexValues = '0123456789abcdef';
  let uuid = '';
  
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4 UUID always has the 14th character as '4'
    } else if (i === 19) {
      // The 19th character is either '8', '9', 'a', or 'b'
      uuid += hexValues.charAt(Math.floor(Math.random() * 4) + 8);
    } else {
      uuid += hexValues.charAt(Math.floor(Math.random() * 16));
    }
  }
  
  return uuid;
}

export const toAppTask = (record: TaskRecord): Task => {
  return {
    id: record.id,
    title: record.title || '',
    description: record.description || '',
    priority: (record.priority as 'high' | 'medium' | 'low') || 'medium',
    isCompleted: record.is_completed === 1,
    isPostponed: record.is_postponed === 1,
    postponedCount: record.postponed_count || 0,
    createdAt: record.created_at || new Date().toISOString(),
    completedAt: record.completed_at || null,
    postponedAt: record.postponed_at || null,
  };
};

// Create a new task
export const createTask = async (task: Omit<Task, 'id'>): Promise<string> => {
  console.log('📝 Creating new task:', task.title);
  const now = new Date().toISOString();
  
  // Generate a UUID compatible with Supabase
  const taskId = generateUUID();
  console.log('🔑 Generated UUID for task:', taskId);
  
  const newTask = {
    id: taskId,
    title: task.title,
    description: task.description || '',
    priority: task.priority || 'medium',
    created_at: now,
    is_completed: 0,
    is_postponed: 0,
    postponed_count: 0,
    user_id: 'current-user', // Replace with actual user ID when auth is implemented
  };

  try {
    // Include the ID in the insert statement
    const sql = `INSERT INTO tasks (id, title, description, priority, created_at, is_completed, is_postponed, postponed_count, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      newTask.id,
      newTask.title,
      newTask.description,
      newTask.priority,
      newTask.created_at,
      newTask.is_completed,
      newTask.is_postponed,
      newTask.postponed_count,
      newTask.user_id
    ];
    await powersync.execute(sql, params);
    
    console.log('✅ Task created successfully:', taskId);
    return taskId;
  } catch (error: any) {
    console.error('❌ Failed to create task:', error?.message || 'Unknown error');
    throw new Error(`Failed to create task: ${error?.message || 'Unknown error'}`);
  }
};

// Update a task
export const updateTask = async (id: string, updates: Partial<Task>): Promise<void> => {
  const updateFields: string[] = [];
  const params: (string | number)[] = [];
  
  if (updates.title !== undefined) {
    updateFields.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    updateFields.push('description = ?');
    params.push(updates.description);
  }
  if (updates.priority !== undefined) {
    updateFields.push('priority = ?');
    params.push(updates.priority);
  }
  
  if (updateFields.length === 0) return;
  
  const sql = `UPDATE tasks SET ${updateFields.join(', ')} WHERE id = ?`;
  params.push(id);
  
  await powersync.execute(sql, params);
};

// Mark a task as completed
export const completeTask = async (id: string): Promise<void> => {
  console.log('✅ Marking task as completed:', id);
  try {
    const now = new Date().toISOString();
    const sql = 'UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?';
    await powersync.execute(sql, [now, id]);
    console.log('✅ Task completed successfully');
  } catch (error: any) {
    console.error('❌ Failed to complete task:', error?.message || 'Unknown error');
    throw error;
  }
};

// Mark a task as postponed
export const postponeTask = async (id: string): Promise<void> => {
  console.log('⏳ Postponing task:', id);
  try {
    const now = new Date().toISOString();
    const sql = `UPDATE tasks 
            SET is_postponed = 1, 
                postponed_at = ?, 
                postponed_count = postponed_count + 1 
            WHERE id = ?`;
    await powersync.execute(sql, [now, id]);
    console.log('✅ Task postponed successfully');
  } catch (error: any) {
    console.error('❌ Failed to postpone task:', error?.message || 'Unknown error');
    throw error;
  }
};

// Delete a task
export const deleteTask = async (id: string): Promise<void> => {
  const sql = 'DELETE FROM tasks WHERE id = ?';
  await powersync.execute(sql, [id]);
};

// Clear all tasks from the database
export const clearAllTasks = async (): Promise<void> => {
  console.log('🧹 Clearing all tasks from PowerSync...');
  try {
    const sql = 'DELETE FROM tasks';
    await powersync.execute(sql);
    console.log('✅ All tasks deleted successfully');
  } catch (error) {
    console.error('❌ Failed to clear tasks:', error);
    throw error;
  }
};

// Hook to get all active tasks - using PowerSync's reactive approach
export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  const sql = `SELECT * FROM tasks 
          WHERE (is_completed = 0) 
          ORDER BY 
            CASE priority 
              WHEN 'high' THEN 1 
              WHEN 'medium' THEN 2 
              WHEN 'low' THEN 3 
              ELSE 4 
            END,
            created_at DESC`;
  
  useEffect(() => {
    console.log('🔍 Setting up active tasks watcher...');
    
    // Create an unsubscribe function
    let unsubscribe: () => void;
    
    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data
        const result = await powersync.execute(sql);
        if (result.rows?._array) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log('📝 Found', tasksList.length, 'active tasks');
          setTasks(tasksList);
          setLoading(false);
        }
        
        // Set up watcher for changes
        const watcher = powersync.watch(sql);
        
        // Create async iterator
        const iterator = watcher[Symbol.asyncIterator]();
        
        // Process function that will be called each time there's a change
        const processNext = async () => {
          try {
            const { value: result, done } = await iterator.next();
            if (done) return;
            
            if (result.rows?._array) {
              const tasksList = result.rows._array.map(toAppTask);
              console.log('📝 Found', tasksList.length, 'active tasks (reactive update)');
              setTasks(tasksList);
            }
            
            // Continue watching for next change
            processNext();
          } catch (err) {
            console.error('❌ Error in tasks watcher:', err);
          }
        };
        
        // Start processing changes
        processNext();
        
        // Define cleanup
        unsubscribe = () => {
          // Just let the iterator be garbage collected
          // No explicit .return() needed as it may not be available on all implementations
        };
      } catch (error) {
        console.error('❌ Error setting up task watcher:', error);
        setLoading(false);
      }
    };
    
    setupWatcher();
    
    // Cleanup function
    return () => {
      console.log('🔒 Cleaning up active tasks watcher');
      unsubscribe?.();
    };
  }, []);
  
  return { tasks, loading };
};

// Hook to get all completed tasks - using PowerSync's reactive approach
export const useCompletedTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  const sql = `SELECT * FROM tasks 
        WHERE is_completed = 1 
        ORDER BY completed_at DESC`;
  
  useEffect(() => {
    console.log('🔍 Setting up completed tasks watcher...');
    
    // Create an unsubscribe function
    let unsubscribe: () => void;
    
    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data
        const result = await powersync.execute(sql);
        if (result.rows?._array) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log('✅ Found', tasksList.length, 'completed tasks');
          setTasks(tasksList);
          setLoading(false);
        }
        
        // Set up watcher for changes
        const watcher = powersync.watch(sql);
        
        // Create async iterator
        const iterator = watcher[Symbol.asyncIterator]();
        
        // Process function that will be called each time there's a change
        const processNext = async () => {
          try {
            const { value: result, done } = await iterator.next();
            if (done) return;
            
            if (result.rows?._array) {
              const tasksList = result.rows._array.map(toAppTask);
              console.log('✅ Found', tasksList.length, 'completed tasks (reactive update)');
              setTasks(tasksList);
            }
            
            // Continue watching for next change
            processNext();
          } catch (err) {
            console.error('❌ Error in completed tasks watcher:', err);
          }
        };
        
        // Start processing changes
        processNext();
        
        // Define cleanup
        unsubscribe = () => {
          // Just let the iterator be garbage collected
          // No explicit .return() needed as it may not be available on all implementations
        };
      } catch (error) {
        console.error('❌ Error setting up completed tasks watcher:', error);
        setLoading(false);
      }
    };
    
    setupWatcher();
    
    // Cleanup function
    return () => {
      console.log('🔒 Cleaning up completed tasks watcher');
      unsubscribe?.();
    };
  }, []);
  
  return { tasks, loading };
};

// Hook to get all postponed tasks - using PowerSync's reactive approach
export const usePostponedTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  
  const sql = `SELECT * FROM tasks 
        WHERE is_postponed = 1 AND is_completed = 0
        ORDER BY postponed_at DESC`;
  
  useEffect(() => {
    console.log('🔍 Setting up postponed tasks watcher...');
    
    // Create an unsubscribe function
    let unsubscribe: () => void;
    
    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data
        const result = await powersync.execute(sql);
        if (result.rows?._array) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log('⏳ Found', tasksList.length, 'postponed tasks');
          setTasks(tasksList);
          setLoading(false);
        }
        
        // Set up watcher for changes
        const watcher = powersync.watch(sql);
        
        // Create async iterator
        const iterator = watcher[Symbol.asyncIterator]();
        
        // Process function that will be called each time there's a change
        const processNext = async () => {
          try {
            const { value: result, done } = await iterator.next();
            if (done) return;
            
            if (result.rows?._array) {
              const tasksList = result.rows._array.map(toAppTask);
              console.log('⏳ Found', tasksList.length, 'postponed tasks (reactive update)');
              setTasks(tasksList);
            }
            
            // Continue watching for next change
            processNext();
          } catch (err) {
            console.error('❌ Error in postponed tasks watcher:', err);
          }
        };
        
        // Start processing changes
        processNext();
        
        // Define cleanup
        unsubscribe = () => {
          // Just let the iterator be garbage collected
          // No explicit .return() needed as it may not be available on all implementations
        };
      } catch (error) {
        console.error('❌ Error setting up postponed tasks watcher:', error);
        setLoading(false);
      }
    };
    
    setupWatcher();
    
    // Cleanup function
    return () => {
      console.log('🔒 Cleaning up postponed tasks watcher');
      unsubscribe?.();
    };
  }, []);
  
  return { tasks, loading };
};
