import { powersync } from "./database";
import { TaskRecord } from "./schema";
import { useEffect, useState } from "react";
import { Task } from "@/types/task";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "../supabase/client";
import { getCurrentUser } from "./userService";
import { ParticipantRole, TaskParticipant } from "@/types/task";
// Not using useQuery since we need more control over the watch pattern

// Configuration
const POLL_INTERVAL_MS = 2000; // 2 seconds
const DEFAULT_PRIORITY = "medium" as const;

// Convert PowerSync record to app Task type
// Function to generate UUID that's compatible with Supabase
function generateUUID(): string {
  // Implementation based on RFC4122 version 4
  const hexValues = "0123456789abcdef";
  let uuid = "";

  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += "-";
    } else if (i === 14) {
      uuid += "4"; // Version 4 UUID always has the 14th character as '4'
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
    title: record.title || "",
    description: record.description || "",
    priority: (record.priority as "high" | "medium" | "low") || "medium",
    isCompleted: record.is_completed === 1,
    isPostponed: record.is_postponed === 1,
    postponedCount: record.postponed_count || 0,
    createdAt: record.created_at || new Date().toISOString(),
    completedAt: record.completed_at || null,
    postponedAt: record.postponed_at || null,
    creatorId: record.creator_id || null,
    category: record.category || null,
  };
};

// Create a new task
export const createTask = async (task: Omit<Task, "id">, contributorIds: number[] = []): Promise<string> => {
  console.log("📝 Creating new task:", task.title);
  const now = new Date().toISOString();

  // Generate a UUID compatible with Supabase
  const taskId = generateUUID();
  console.log("🔑 Generated UUID for task:", taskId);

  // Get the current user as creator
  const currentUser = await getCurrentUser();
  const creatorId = currentUser?.id || null;
  
  const newTask = {
    id: taskId,
    title: task.title,
    description: task.description || "",
    priority: task.priority || "medium",
    created_at: now,
    is_completed: 0,
    is_postponed: 0,
    postponed_count: 0,
    creator_id: creatorId,
    category: task.category || null,
  };

  try {
    // Use Supabase for the initial insert to make sure the task gets properly created in the database
    const { error } = await supabase.from('tasks').insert([newTask]);
    
    if (error) {
      throw new Error(`Failed to create task in Supabase: ${error.message}`);
    }
    
    // Add the creator as a participant with role 'owner'
    if (creatorId) {
      await supabase.from('participants').insert({
        task_id: taskId,
        user_id: creatorId,
        role: 'owner'
      });
    }
    
    // Add other participants as 'nudger'
    for (const contributorId of contributorIds) {
      if (contributorId !== creatorId) {
        await supabase.from('participants').insert({
          task_id: taskId,
          user_id: contributorId,
          role: 'nudger'
        });
      }
    }

    // Also insert into local PowerSync database for immediate UI update
    const sql = `INSERT INTO tasks (
      id, 
      title, 
      description, 
      priority, 
      created_at, 
      is_completed, 
      is_postponed, 
      postponed_count, 
      creator_id, 
      category
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      newTask.id,
      newTask.title,
      newTask.description,
      newTask.priority,
      newTask.created_at,
      newTask.is_completed,
      newTask.is_postponed,
      newTask.postponed_count,
      newTask.creator_id,
      newTask.category,
    ];
    
    await powersync.execute(sql, params);

    console.log("✅ Task created successfully:", taskId);
    return taskId;
  } catch (error: any) {
    console.error(
      "❌ Failed to create task:",
      error?.message || "Unknown error"
    );
    throw new Error(
      `Failed to create task: ${error?.message || "Unknown error"}`
    );
  }
};

// Update a task
export const updateTask = async (
  id: string,
  updates: Partial<Task>
): Promise<void> => {
  const updateFields: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.title !== undefined) {
    updateFields.push("title = ?");
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    updateFields.push("description = ?");
    params.push(updates.description);
  }
  if (updates.priority !== undefined) {
    updateFields.push("priority = ?");
    params.push(updates.priority);
  }
  if (updates.category !== undefined) {
    updateFields.push("category = ?");
    params.push(updates.category);
  }

  if (updateFields.length === 0) return;

  const sql = `UPDATE tasks SET ${updateFields.join(", ")} WHERE id = ?`;
  params.push(id);

  await powersync.execute(sql, params);
  
  // Also update in Supabase
  const updateData: Record<string, any> = {};
  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.priority !== undefined) updateData.priority = updates.priority;
  if (updates.category !== undefined) updateData.category = updates.category;
  
  if (Object.keys(updateData).length > 0) {
    await supabase.from('tasks').update(updateData).eq('id', id);
  }
};

// Get participants for a task
export const getTaskParticipants = async (taskId: string) => {
  try {
    // First check if the task exists to avoid errors
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
      .single();
      
    if (taskError || !taskData) {
      console.error('Error or task not found:', taskError);
      return [];
    }
    
    // Now get participants with user data
    const { data, error } = await supabase
      .from('participants')
      .select(`
        id,
        role,
        user_id,
        task_id,
        joined_at,
        users:user_id (
          id,
          first_name,
          last_name,
          email,
          created_at
        )
      `)
      .eq('task_id', taskId);
    
    if (error) {
      console.error('Error fetching task participants:', error);
      return [];
    }
    
    // Map to the correct structure with properly typed user data
    const participants = data.map(item => {
      // Extract user data from the users array/object returned by Supabase
      const userData = item.users && (
        Array.isArray(item.users) 
          ? (item.users.length > 0 ? item.users[0] : null) 
          : item.users
      );
      
      return {
        id: item.id,
        task_id: item.task_id,
        user_id: item.user_id,
        role: item.role,
        joined_at: item.joined_at,
        user: userData
      };
    });
    
    return participants;
  } catch (error) {
    console.error('Error in getTaskParticipants:', error);
    return [];
  }
};

// Add a participant to a task
export const addTaskParticipant = async (taskId: string, userId: number, role: 'owner' | 'nudger' = 'nudger') => {
  try {
    console.log(`Adding participant with user ID ${userId} to task ${taskId} with role ${role}`);
    
    // Ensure user_id is a number
    const numericUserId = Number(userId);
    
    const { data, error } = await supabase
      .from('participants')
      .insert({
        task_id: taskId,
        user_id: numericUserId,
        role
      })
      .select();
    
    if (error) {
      console.error('Error adding task participant:', error);
      throw error;
    }
    
    console.log('Successfully added participant to task');
    
    // After adding a participant, fetch the task so it's available in PowerSync
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
      
    if (taskError) {
      console.error('Error fetching task after adding participant:', taskError);
    } else if (taskData) {
      // Insert the task into PowerSync to ensure it's available immediately
      console.log('Syncing task to PowerSync after adding participant');
      await powersync.execute(`
        INSERT OR REPLACE INTO tasks (
          id, title, description, priority, created_at, completed_at, postponed_at, 
          postponed_count, creator_id, category, is_completed, is_postponed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        taskData.id,
        taskData.title,
        taskData.description,
        taskData.priority,
        taskData.created_at,
        taskData.completed_at,
        taskData.postponed_at,
        taskData.postponed_count || 0,
        taskData.creator_id,
        taskData.category,
        taskData.is_completed ? 1 : 0,
        taskData.is_postponed ? 1 : 0
      ]);
    }
    
    return true;
  } catch (error) {
    console.error('Error in addTaskParticipant:', error);
    throw error;
  }
};

// Remove a participant from a task
export const removeTaskParticipant = async (participantId: number) => {
  try {
    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('id', participantId);
    
    if (error) {
      console.error('Error removing task participant:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error in removeTaskParticipant:', error);
    throw error;
  }
};

// Get the current user's role for a specific task
export const getCurrentUserRoleForTask = async (taskId: string): Promise<ParticipantRole | null> => {
  try {
    console.log(`--> Checking role for task ${taskId}`);
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.log("No logged in user found");
      return null;
    }
    
    const userId = currentUser.id;
    if (!userId) {
      console.log("Invalid user ID");
      return null;
    }
    
    console.log(`--> Checking for user ${userId} on task ${taskId}`);
    
    // Check if user is the task creator first (also an owner)
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('creator_id')
      .eq('id', taskId)
      .single();
      
    if (taskError) {
      console.error('Error fetching task:', taskError);
    } else if (task && Number(task.creator_id) === Number(userId)) {
      console.log(`--> User ${userId} is creator of task ${taskId}`);
      return 'owner'; // Creator is always an owner
    }
    
    // Otherwise check participants table
    const { data, error } = await supabase
      .from('participants')
      .select('role')
      .eq('task_id', taskId)
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('--> Error fetching user role:', error);
      return null;
    }
    
    console.log(`--> Found role for user ${userId} on task ${taskId}: ${data?.role}`);
    return data?.role as ParticipantRole || null;
  } catch (error) {
    console.error('Error in getCurrentUserRoleForTask:', error);
    return null;
  }
};

// Function to fetch tasks including ones where the user is a participant
const fetchTasksWithParticipants = async () => {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.log("No logged in user found for participant tasks");
      return [];
    }
    
    // Ensure user_id is properly typed as number for database queries
    const userId = currentUser.id ? Number(currentUser.id) : null;
    if (!userId) {
      console.log("Invalid user ID for participant query");
      return [];
    }
    
    console.log(`Fetching participant tasks for user ID: ${userId}`);
    
    // Get all tasks where user is a participant
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select(`
        task_id
      `)
      .eq('user_id', userId);
      
    if (participantError) {
      console.error("Error fetching participant tasks:", participantError);
      return [];
    }
    
    // Early return if no participant tasks found
    if (!participantData || participantData.length === 0) {
      console.log("No participant tasks found");
      return [];
    }
    
    // Extract task IDs as an array of strings
    const participantTaskIds = participantData
      .map(p => p.task_id)
      .filter(Boolean); // Filter out any null/undefined values
    
    if (participantTaskIds.length === 0) {
      console.log("No valid participant task IDs found");
      return [];
    }
    
    console.log(`Found ${participantTaskIds.length} task IDs where user is participant`);
    
    // Get all tasks without filtering by completion status
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .in('id', participantTaskIds);
      
    if (tasksError) {
      console.error("Error fetching tasks by IDs:", tasksError);
      return [];
    }
    
    console.log(`Successfully fetched ${tasks?.length || 0} tasks where user is participant`);
    return tasks || [];
  } catch (error) {
    console.error("Error in fetchTasksWithParticipants:", error);
    return [];
  }
};

// Function to fetch participant tasks and sync them to PowerSync
const fetchParticipantTasks = async () => {
  try {
    // Get current user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.log("No logged in user found for tasks");
      return;
    }
    
    // Ensure creator_id is properly typed as number for database queries
    const creatorId = currentUser.id ? Number(currentUser.id) : null;
    
    // Get ALL tasks where the user is a creator (including completed ones)
    const { data: creatorTasks, error: creatorError } = await supabase
      .from('tasks')
      .select('*')
      .eq('creator_id', creatorId);
    
    if (creatorError) {
      console.error("Error fetching creator tasks:", creatorError);
    } else {
      console.log(`Found ${creatorTasks?.length || 0} tasks where user is creator`);
    }
    
    // Get ALL tasks where the user is a participant (including completed)
    // First get all participant relationships
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select(`task_id`)
      .eq('user_id', currentUser.id);
    
    if (participantError) {
      console.error("Error fetching participant relationships:", participantError);
    }
    
    // Get the actual tasks for these relationships
    let participantTasks: any[] = [];
    if (participantData && participantData.length > 0) {
      const participantTaskIds = participantData
        .map(p => p.task_id)
        .filter(Boolean);
        
      if (participantTaskIds.length > 0) {
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('id', participantTaskIds);
          
        if (tasksError) {
          console.error("Error fetching participant tasks:", tasksError);
        } else {
          participantTasks = tasks || [];
          console.log(`Found ${participantTasks.length} tasks where user is participant`);
        }
      }
    }
    
    // Combine all tasks and remove duplicates
    const allTasks = [...(creatorTasks || []), ...participantTasks];
    const uniqueTasks = allTasks.filter((task, index, self) => 
      index === self.findIndex((t) => t.id === task.id)
    );
    
    console.log(`Found ${uniqueTasks.length} total unique tasks for user`);
    
    // Insert or update these tasks in PowerSync
    for (const task of uniqueTasks) {
      await powersync.execute(`
        INSERT OR REPLACE INTO tasks (
          id, title, description, priority, created_at, completed_at, postponed_at, 
          postponed_count, creator_id, category, is_completed, is_postponed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        task.id,
        task.title,
        task.description,
        task.priority,
        task.created_at,
        task.completed_at,
        task.postponed_at,
        task.postponed_count || 0,
        task.creator_id,
        task.category,
        task.is_completed ? 1 : 0,
        task.is_postponed ? 1 : 0
      ]);
    }
  } catch (error) {
    console.error("Error syncing tasks:", error);
  }
};

// Mark a task as completed
export const completeTask = async (id: string): Promise<boolean> => {
  console.log("✅ Marking task as completed:", id);
  try {
    // First check if current user is the task owner
    const userRole = await getCurrentUserRoleForTask(id);
    console.log(`User role for task ${id}: ${userRole}`);
    
    if (userRole !== 'owner') {
      console.error("❌ Only task owners can mark tasks as complete");
      return false;
    }

    const now = new Date().toISOString();
    
    // Update in Supabase first to ensure data consistency - use integer 1 instead of boolean true
    const { error } = await supabase
      .from('tasks')
      .update({ 
        is_completed: 1, 
        completed_at: now 
      })
      .eq('id', id);
      
    if (error) {
      console.error("Failed to update task in Supabase:", error);
      return false;
    }
    
    // Then update in local PowerSync database
    const sql = "UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?";
    await powersync.execute(sql, [now, id]);
    
    console.log(`✅ Task ${id} completed successfully at ${now}`);
    
    // Fetch participant tasks to ensure all users get the updated task state
    await fetchParticipantTasks();
    
    // Force a refresh of the tasks to ensure they're in sync
    setTimeout(() => {
      console.log("🔄 Triggering task refresh after completion");
      fetchParticipantTasks();
    }, 1000);
    
    return true;
  } catch (error: any) {
    console.error(
      "❌ Failed to complete task:",
      error?.message || "Unknown error"
    );
    throw error;
  }
};

// Mark a task as postponed
export const postponeTask = async (id: string): Promise<void> => {
  console.log("⏳ Postponing task:", id);
  try {
    const now = new Date().toISOString();
    // Modified to only mark as postponed without removing from main queue
    const sql = `UPDATE tasks 
            SET is_postponed = 1, 
                postponed_at = ?, 
                postponed_count = postponed_count + 1 
            WHERE id = ?`;
    await powersync.execute(sql, [now, id]);
    
    // Also update in Supabase
    await supabase
      .from('tasks')
      .update({ 
        is_postponed: 1, 
        postponed_at: now,
        postponed_count: supabase.rpc('increment_postponed_count', { task_id: id })
      })
      .eq('id', id);
    
    console.log("✅ Task postponed successfully");
  } catch (error: any) {
    console.error(
      "❌ Failed to postpone task:",
      error?.message || "Unknown error"
    );
    throw error;
  }
};

// Move a task back from Later Stack to main tasks
export const unpostponeTask = async (id: string): Promise<void> => {
  console.log("↩️ Moving task back to main tasks:", id);
  try {
    const sql = `UPDATE tasks 
            SET is_postponed = 0,
                postponed_at = NULL
            WHERE id = ?`;
    await powersync.execute(sql, [id]);
    
    // Also update in Supabase
    await supabase
      .from('tasks')
      .update({ 
        is_postponed: 0, 
        postponed_at: null
      })
      .eq('id', id);
    
    console.log("✅ Task moved back to main tasks successfully");
  } catch (error: any) {
    console.error(
      "❌ Failed to move task back to main tasks:",
      error?.message || "Unknown error"
    );
    throw error;
  }
};

// Delete a task
export const deleteTask = async (id: string): Promise<void> => {
  const sql = "DELETE FROM tasks WHERE id = ?";
  await powersync.execute(sql, [id]);
  
  // Also delete from Supabase
  await supabase
    .from('tasks')
    .delete()
    .eq('id', id);
};

// Clear all tasks from the database
export const clearAllTasks = async (): Promise<void> => {
  console.log("🧹 Clearing all tasks from both PowerSync and Supabase...");
  try {
    // First clear from PowerSync to stop any sync attempts
    console.log("Deleting all tasks from PowerSync...");
    await powersync.execute("DELETE FROM tasks");
    await powersync.disconnect();
    
    // Wait a moment to ensure any in-progress syncs complete
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Then clear from Supabase
    console.log("Deleting all participants from Supabase...");
    await supabase
      .from('participants')
      .delete()
      .neq('id', 0); // Delete all participants
    
    console.log("Deleting all activities from Supabase...");
    await supabase
      .from('activities')
      .delete()
      .neq('id', 0); // Delete all activities
    
    console.log("Deleting all notifications from Supabase...");
    await supabase
      .from('notifications')
      .delete()
      .neq('id', 0); // Delete all notifications
    
    console.log("Deleting all tasks from Supabase...");
    await supabase
      .from('tasks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all tasks
    
    // COMPLETE RESET: Delete the PowerSync database file
    try {
      console.log("🗑️ Deleting PowerSync database file to clear all pending sync operations...");
      // Access internal properties safely - this is a workaround
      const dbFilename = (powersync as any)._settings?.database?.dbFilename || 'nudge_tasks.db';
      const FileSystem = require('expo-file-system');
      const dbPath = `${FileSystem.documentDirectory}SQLite/${dbFilename}`;
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      console.log("✅ Successfully deleted PowerSync database file");
    } catch (e) {
      console.log("⚠️ Could not delete database file:", e);
    }
    
    // Check if we have a user with ID 1 in Supabase (solves foreign key constraint issues)
    console.log("👤 Checking if user with ID 1 exists in Supabase...");
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', 1)
      .single();
      
    if (userError) {
      console.log("⚠️ No user with ID 1 found - creating one to fix foreign key constraints");
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: 1,
          first_name: 'System',
          last_name: 'User',
          email: 'system@example.com'
        });
        
      if (insertError) {
        console.error("❌ Error creating user:", insertError);
      } else {
        console.log("✅ User with ID 1 created successfully");
      }
    } else {
      console.log("✅ User with ID 1 already exists:", userData);
    }
    
    console.log("✅ All tasks and related data deleted successfully");
    
    // Force app to reload data after a short delay
    setTimeout(() => {
      console.log("🔄 Forcing data reload after reset");
    }, 1000);
    
  } catch (error) {
    console.error("❌ Failed to clear tasks:", error);
    throw error;
  }
};

// Helper function to convert database row to Task object
const convertTaskFromDatabase = (row: any): Task => {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    isCompleted: Boolean(row.is_completed),
    isPostponed: Boolean(row.is_postponed),
    postponedCount: row.postponed_count,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    postponedAt: row.postponed_at,
    creatorId: row.creator_id,
    category: row.category,
  };
};

// Hook to get all active tasks - using PowerSync's reactive approach
export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // SQL query for active tasks, ordered by priority
  const activeTasksQuery = `
    SELECT * FROM tasks 
    WHERE is_completed = 0 
    ORDER BY 
      is_postponed ASC,
      CASE priority 
        WHEN 'high' THEN 1 
        WHEN 'medium' THEN 2 
        WHEN 'low' THEN 3 
        ELSE 4 
      END,
      created_at DESC`;

  useEffect(() => {
    console.log("🔍 Setting up active tasks watcher...");
    
    // Create an unsubscribe function
    let unsubscribe: () => void;
    let isMounted = true;
    
    // Set up a periodic refresh for tasks
    const refreshIntervalId = setInterval(() => {
      if (isMounted) {
        console.log("⏰ Periodic task refresh triggered");
        fetchParticipantTasks();
      }
    }, 10000); // Refresh every 10 seconds
    
    const initTasks = async () => {
      try {
        // First fetch tasks including ones where the user is a participant from Supabase
        await fetchParticipantTasks();
        
        // Then set up a watcher for the PowerSync database using the iterator pattern
        const watcher = powersync.watch(activeTasksQuery);
        const iterator = watcher[Symbol.asyncIterator]();
        
        // Get initial data
        const initialResult = await powersync.execute(activeTasksQuery);
        if (initialResult.rows?._array && isMounted) {
          const initialTasks = initialResult.rows._array.map(convertTaskFromDatabase);
          console.log(`📊 Initial tasks loaded: ${initialTasks.length}`);
          setTasks(initialTasks);
          setLoading(false);
        }
        
        // Define a function to process results from the watcher
        const processNext = async () => {
          try {
            const { value: result, done } = await iterator.next();
            if (done) return;
            
            if (result.rows?._array && isMounted) {
              const updatedTasks = result.rows._array.map(convertTaskFromDatabase);
              console.log(`📊 Watch update - ${updatedTasks.length} tasks`);
              setTasks(updatedTasks);
            }
            
            // Continue watching for changes
            processNext();
          } catch (err) {
            console.error("❌ Error in tasks watcher:", err);
            if (isMounted) {
              setError(err instanceof Error ? err : new Error(String(err)));
            }
          }
        };
        
        // Start watching for changes
        processNext();
        
        // Set up cleanup function
        unsubscribe = () => {
          // The iterator will be garbage collected
          console.log("🔒 Cleaning up tasks watcher");
        };
      } catch (e) {
        console.error("❌ Error watching tasks:", e);
        if (isMounted) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setLoading(false);
        }
      }
    };
    
    initTasks();
    
    return () => {
      isMounted = false;
      clearInterval(refreshIntervalId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return { tasks, loading, error };
};

// Hook to get all completed tasks - using PowerSync's reactive approach
export const useCompletedTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const sql = `SELECT * FROM tasks 
        WHERE is_completed = 1 
        ORDER BY completed_at DESC`;

  useEffect(() => {
    console.log("🔍 Setting up completed tasks watcher...");

    // Create an unsubscribe function
    let unsubscribe: () => void;

    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data
        const result = await powersync.execute(sql);
        if (result.rows?._array) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log("✅ Found", tasksList.length, "completed tasks");
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
              console.log(
                "✅ Found",
                tasksList.length,
                "completed tasks (reactive update)"
              );
              setTasks(tasksList);
            }

            // Continue watching for next change
            processNext();
          } catch (err) {
            console.error("❌ Error in completed tasks watcher:", err);
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
        console.error("❌ Error setting up completed tasks watcher:", error);
        setLoading(false);
      }
    };

    setupWatcher();

    // Cleanup function
    return () => {
      console.log("🔒 Cleaning up completed tasks watcher");
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
        WHERE is_postponed = 1
        ORDER BY postponed_at DESC`;

  useEffect(() => {
    console.log("🔍 Setting up postponed tasks watcher...");

    // Create an unsubscribe function
    let unsubscribe: () => void;

    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data
        const result = await powersync.execute(sql);
        if (result.rows?._array) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log("⏳ Found", tasksList.length, "postponed tasks");
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
              console.log(
                "⏳ Found",
                tasksList.length,
                "postponed tasks (reactive update)"
              );
              setTasks(tasksList);
            }

            // Continue watching for next change
            processNext();
          } catch (err) {
            console.error("❌ Error in postponed tasks watcher:", err);
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
        console.error("❌ Error setting up postponed tasks watcher:", error);
        setLoading(false);
      }
    };

    setupWatcher();

    // Cleanup function
    return () => {
      console.log("🔒 Cleaning up postponed tasks watcher");
      unsubscribe?.();
    };
  }, []);

  return { tasks, loading };
};

// Mark a task as nudged
export const nudgeTask = async (id: string): Promise<boolean> => {
  console.log("📢 Nudging task:", id);
  try {
    // First check if current user is a participant (any role can nudge)
    const userRole = await getCurrentUserRoleForTask(id);
    console.log(`User role for task ${id}: ${userRole}`);
    
    if (userRole !== 'nudger') {
      console.error("❌ Only nudgers can nudge tasks");
      return false;
    }

    const now = new Date().toISOString();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      console.error("❌ No current user found");
      return false;
    }
    
    console.log(`Creating nudge activity for user ${currentUser.id} on task ${id}`);
    
    // Get the participant ID for the current user FIRST
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('task_id', id)
      .eq('user_id', currentUser.id)
      .single();
      
    if (participantError || !participantData?.id) {
      console.error("Error finding participant record:", participantError);
      return false;
    }
    
    // 1. Create an activity for this nudge WITH the participant_id
    const { data: activityData, error: activityError } = await supabase
      .from('activities')
      .insert({
        task_id: id,
        user_id: currentUser.id,
        participant_id: participantData.id,
        type: 'nudge', 
        created_at: now
      })
      .select()
      .single();
      
    if (activityError) {
      console.error("Error creating nudge activity:", activityError);
      return false;
    }
    
    // 2. Get all participants to notify them
    const participants = await getTaskParticipants(id);
    
    // 3. Create notifications for all other participants (excluding the nudger)
    for (const participant of participants) {
      if (participant.user_id !== currentUser.id) {
        await supabase.from('notifications').insert({
          user_id: participant.user_id,
          activity_id: activityData.id,
          is_read: false,
          created_at: now
        });
      }
    }
    
    console.log("✅ Task nudged successfully at", now);
    return true;
  } catch (error: any) {
    console.error(
      "❌ Failed to nudge task:",
      error?.message || "Unknown error"
    );
    throw error;
  }
};

// Hook to get all tasks - using PowerSync's reactive approach
export const useAllTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const sql = `SELECT * FROM tasks 
        ORDER BY created_at DESC`;

  useEffect(() => {
    console.log("🔍 Setting up all tasks watcher...");

    // Create an unsubscribe function
    let unsubscribe: () => void;

    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data
        const result = await powersync.execute(sql);
        if (result.rows?._array) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log("📝 Found", tasksList.length, "total tasks");
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
              console.log(
                "📝 Found",
                tasksList.length,
                "total tasks (reactive update)"
              );
              setTasks(tasksList);
            }

            // Continue watching for next change
            processNext();
          } catch (err) {
            console.error("❌ Error in all tasks watcher:", err);
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
        console.error("❌ Error setting up all tasks watcher:", error);
        setLoading(false);
      }
    };

    setupWatcher();

    // Cleanup function
    return () => {
      console.log("🔒 Cleaning up all tasks watcher");
      unsubscribe?.();
    };
  }, []);

  return { tasks, loading };
};

// Debug function to log task participants and roles
export const debugTaskParticipants = async (taskId: string): Promise<void> => {
  try {
    console.log(`🔍 Debugging task ${taskId} participants and roles:`);
    
    // 1. Get the task information
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
      
    if (taskError) {
      console.error('Error fetching task:', taskError);
      return;
    }
    
    console.log(`Task: ${JSON.stringify(task, null, 2)}`);
    
    // 2. Get all participants for this task
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select(`
        id, 
        role, 
        user_id,
        users:user_id (
          id, 
          first_name, 
          last_name
        )
      `)
      .eq('task_id', taskId);
      
    if (participantsError) {
      console.error('Error fetching participants:', participantsError);
      return;
    }
    
    console.log(`Found ${participants.length} participants:`);
    participants.forEach((p, i) => {
      console.log(`  ${i+1}. Participant ID: ${p.id}, Role: ${p.role}, User: ${p.users?.first_name} ${p.users?.last_name} (ID: ${p.user_id})`);
    });
    
    // 3. Get the current user and their role
    const currentUser = await getCurrentUser();
    if (currentUser) {
      const userRole = await getCurrentUserRoleForTask(taskId);
      console.log(`Current user ID: ${currentUser.id} has role: ${userRole || 'none'}`);
    } else {
      console.log('No current user found');
    }
    
  } catch (error) {
    console.error('Error in debugTaskParticipants:', error);
  }
};
