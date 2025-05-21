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
    isCompleted: record.is_completed === 1 || false,
    isPostponed: record.is_postponed === 1 || false,
    isArchived: record.is_archived === 1 || false,
    postponedCount: record.postponed_count || 0,
    createdAt: record.created_at || new Date().toISOString(),
    completedAt: record.completed_at || null,
    postponedAt: record.postponed_at || null,
    archivedAt: record.archived_at || null,
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
    
    // Trigger an update of participant tasks in the background
    setTimeout(() => {
      try {
        console.log("Triggering background refresh after task creation");
        fetchParticipantTasks(true).catch(e => 
          console.warn("Background refresh after task creation failed:", e)
        );
      } catch (refreshError) {
        console.warn("Error initiating background refresh:", refreshError);
      }
    }, 500);

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

// Batch fetch participants for multiple tasks at once
export const batchGetTaskParticipants = async (taskIds: string[]): Promise<Record<string, TaskParticipant[]>> => {
  try {
    if (!taskIds.length) return {};
    
    console.log(`Fetching participants for ${taskIds.length} tasks in batch`);
    
    // Filter out 'add' task if present
    const validTaskIds = taskIds.filter(id => id !== 'add');
    if (!validTaskIds.length) return {};
    
    // Get all participants for the provided task IDs in a single query
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
      .in('task_id', validTaskIds);
    
    if (error) {
      console.error('Error batch fetching task participants:', error);
      return {};
    }
    
    // Group participants by task_id
    const participantsByTaskId: Record<string, TaskParticipant[]> = {};
    
    // Initialize empty arrays for all task ids
    validTaskIds.forEach(id => {
      participantsByTaskId[id] = [];
    });
    
    // Map and organize participants
    data.forEach(item => {
      const userData = item.users && (
        Array.isArray(item.users) 
          ? (item.users.length > 0 ? item.users[0] : null) 
          : item.users
      );
      
      const participant = {
        id: item.id,
        task_id: item.task_id,
        user_id: item.user_id,
        role: item.role,
        joined_at: item.joined_at,
        user: userData
      };
      
      if (participantsByTaskId[item.task_id]) {
        participantsByTaskId[item.task_id].push(participant);
      } else {
        participantsByTaskId[item.task_id] = [participant];
      }
    });
    
    console.log(`Successfully fetched participants for ${Object.keys(participantsByTaskId).length} tasks`);
    return participantsByTaskId;
  } catch (error) {
    console.error('Error in batchGetTaskParticipants:', error);
    return {};
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

// Function to fetch tasks where the user is a participant
export const fetchParticipantTasks = async (background: boolean = false) => {
  try {
    if (!background) {
      console.log("🔄 Syncing tasks with Supabase...");
    }
    
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      console.error("Cannot fetch participant tasks: User not logged in");
      return;
    }
    
    // Ensure user_id is properly typed as number for database queries
    const userId = currentUser.id ? Number(currentUser.id) : null;
    if (!userId) {
      console.log("Invalid user ID for participant query");
      return;
    }
    
    // Get participant tasks in the background or foreground
    if (!background) {
      console.log(`Fetching tasks for user ID: ${userId}`);
    }
    
    // First fetch all participant task IDs
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select(`task_id`)
      .eq('user_id', userId);
      
    if (participantError) {
      console.error("Error fetching participant tasks:", participantError);
      return;
    }
    
    let participantTaskIds: string[] = [];
    if (participantData && participantData.length > 0) {
      participantTaskIds = participantData
        .map(p => p.task_id)
        .filter(Boolean);
    }
    
    // FIRST fetch completed tasks - prioritize this to ensure completion status is synced
    let completedTasks: any[] = [];
    
    // 1. First get completed tasks where user is creator
    const { data: completedCreatorTasks, error: completedCreatorError } = await supabase
      .from('tasks')
      .select('*')
      .eq('creator_id', userId)
      .eq('is_completed', 1);
      
    if (completedCreatorError) {
      console.error("Error fetching completed creator tasks:", completedCreatorError);
    } else if (completedCreatorTasks) {
      completedTasks = [...completedTasks, ...completedCreatorTasks];
      if (!background) {
        console.log(`Found ${completedCreatorTasks.length} completed tasks where user is creator`);
      }
    }
    
    // 2. Get completed tasks where user is participant
    if (participantTaskIds.length > 0) {
      const { data: completedParticipantTasks, error: completedParticipantError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', participantTaskIds)
        .eq('is_completed', 1);
        
      if (completedParticipantError) {
        console.error("Error fetching completed participant tasks:", completedParticipantError);
      } else if (completedParticipantTasks) {
        completedTasks = [...completedTasks, ...completedParticipantTasks];
        if (!background) {
          console.log(`Found ${completedParticipantTasks.length} completed tasks where user is participant`);
        }
      }
    }
    
    // Ensure no duplicates in completed tasks
    const uniqueCompletedTasks = completedTasks.filter((task, index, self) => 
      index === self.findIndex((t) => t.id === task.id)
    );
    
    // Insert completed tasks into PowerSync FIRST
    if (uniqueCompletedTasks.length > 0 && !background) {
      console.log(`Adding/updating ${uniqueCompletedTasks.length} completed tasks in PowerSync`);
    }
    
    for (const task of uniqueCompletedTasks) {
      try {
        // Explicitly mark as completed 
        await powersync.execute(`
          INSERT OR REPLACE INTO tasks (
            id, title, description, priority, created_at, completed_at, postponed_at, 
            postponed_count, creator_id, category, is_completed, is_postponed, is_archived
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          1, // Explicitly set is_completed to 1
          task.is_postponed ? 1 : 0,
          task.is_archived ? 1 : 0
        ]);
        
        // For completed tasks, also clean up any pending operations to prevent sync loops
        try {
          // Remove any pending operations for this task
          await powersync.execute(`DELETE FROM ps_crud WHERE id = ?`, [task.id]);
          
          // Try to clear transaction queue if available
          if ((powersync as any)._crud?.deleteLocalOperations) {
            await (powersync as any)._crud.deleteLocalOperations(task.id);
            if (!background) {
              console.log(`✅ Cleared transaction queue for completed task ${task.id}`);
            }
          }
        } catch (cleanupError) {
          console.warn(`⚠️ Could not clean up operations for task ${task.id}:`, cleanupError);
        }
      } catch (e) {
        console.error(`Error syncing completed task ${task.id} to PowerSync:`, e);
      }
    }
    
    // THEN fetch active tasks
    
    // Get active tasks created by this user
    const { data: activeCreatorTasks, error: activeCreatorError } = await supabase
      .from('tasks')
      .select('*')
      .eq('creator_id', userId)
      .eq('is_completed', 0) 
      .eq('is_archived', 0);
      
    if (activeCreatorError) {
      console.error("Error fetching active creator tasks:", activeCreatorError);
      return;
    }
    
    let activeTasks = activeCreatorTasks || [];
    if (!background) {
      console.log(`Found ${activeTasks.length} active tasks where user is creator`);
    }
    
    // Get active tasks where user is a participant
    if (participantTaskIds.length > 0) {
      const { data: activeParticipantTasks, error: activeParticipantError } = await supabase
        .from('tasks')
        .select('*')
        .in('id', participantTaskIds)
        .eq('is_completed', 0)
        .eq('is_archived', 0);
        
      if (activeParticipantError) {
        console.error("Error fetching active participant tasks:", activeParticipantError);
      } else if (activeParticipantTasks) {
        activeTasks = [...activeTasks, ...activeParticipantTasks];
        if (!background) {
          console.log(`Found ${activeParticipantTasks.length} active tasks where user is participant`);
        }
      }
    }
    
    // Filter out any active tasks that are in the completed tasks list
    // This ensures that if a task is marked as completed in Supabase,
    // it will not be re-added as an active task
    const completedTaskIds = new Set(uniqueCompletedTasks.map(task => task.id));
    const filteredActiveTasks = activeTasks.filter(task => !completedTaskIds.has(task.id));
    
    // If we filtered out any tasks, log it
    if (activeTasks.length !== filteredActiveTasks.length && !background) {
      console.log(`Filtered out ${activeTasks.length - filteredActiveTasks.length} tasks that are marked as completed in Supabase`);
    }
    
    // Ensure no duplicates in active tasks
    const uniqueActiveTasks = filteredActiveTasks.filter((task, index, self) => 
      index === self.findIndex((t) => t.id === task.id)
    );
    
    // Insert active tasks into PowerSync
    if (uniqueActiveTasks.length > 0 && !background) {
      console.log(`Adding/updating ${uniqueActiveTasks.length} active tasks in PowerSync`);
    }
    
    for (const task of uniqueActiveTasks) {
      try {
        // Convert to 0/1 integers for boolean values
        const isCompleted = 0; // Force to 0 since these are active tasks
        const isPostponed = task.is_postponed ? 1 : 0;
        const isArchived = task.is_archived ? 1 : 0;
        
        await powersync.execute(`
          INSERT OR REPLACE INTO tasks (
            id, title, description, priority, created_at, completed_at, postponed_at, 
            postponed_count, creator_id, category, is_completed, is_postponed, is_archived
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          isCompleted,
          isPostponed,
          isArchived
        ]);
      } catch (e) {
        console.error(`Error syncing active task ${task.id} to PowerSync:`, e);
      }
    }
    
    const allTasks = [...uniqueCompletedTasks, ...uniqueActiveTasks];
    
    if (!background) {
      console.log(`Total tasks synced: ${allTasks.length} (${uniqueCompletedTasks.length} completed, ${uniqueActiveTasks.length} active)`);
    }
    
    return allTasks;
  } catch (error) {
    console.error('❌ Error fetching participant tasks:', error);
    throw error;
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
    
    // Update in Supabase to ensure data consistency - use integer 1 for is_completed
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
    
    console.log(`✅ Task ${id} marked as completed in Supabase at ${now}`);
    
    // Delete any pending updates for this task to avoid conflicts
    try {
      // This is a direct operation on local PowerSync to remove any pending updates
      // that might overwrite our completion status
      await powersync.execute(`DELETE FROM ps_crud WHERE id = ?`, [id]);
      console.log(`✅ Cleared any pending operations for task ${id}`);
      
      // Clear the transaction queue for this task to prevent repeated PUT operations
      try {
        // This uses an internal API to clear the transaction queue
        // Note: This is a workaround for the repeated PUT issue
        if ((powersync as any)._crud?.deleteLocalOperations) {
          await (powersync as any)._crud.deleteLocalOperations(id);
          console.log(`✅ Cleared transaction queue for task ${id}`);
        }
      } catch (queueError) {
        console.warn(`⚠️ Could not clear transaction queue for task ${id}:`, queueError);
        // Continue anyway - this is just an optimization
      }
    } catch (e) {
      console.warn(`⚠️ Unable to clear pending operations for task ${id}:`, e);
      // Continue anyway - this is just an optimization
    }
    
    // Forcefully update in local PowerSync database using a direct replace instead of update
    // This ensures the record is completely refreshed rather than just one field being updated
    try {
      // First get the current task data to ensure we have all fields
      const { data: taskData } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single();
      
      if (taskData) {
        // Replace the entire task record to ensure all fields are consistent
        await powersync.execute(`
          INSERT OR REPLACE INTO tasks (
            id, title, description, priority, created_at, completed_at, postponed_at, 
            postponed_count, creator_id, category, is_completed, is_postponed, is_archived
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          taskData.id,
          taskData.title,
          taskData.description,
          taskData.priority,
          taskData.created_at,
          now, // Use our timestamp for consistent completion time
          taskData.postponed_at,
          taskData.postponed_count || 0,
          taskData.creator_id,
          taskData.category,
          1, // Explicitly set is_completed to 1
          taskData.is_postponed ? 1 : 0,
          taskData.is_archived ? 1 : 0
        ]);
        
        console.log(`✅ Task ${id} completely replaced in PowerSync with completed status`);
        
        // Force a write to the local database without creating a transaction
        // This is a direct write that won't be queued for sync
        try {
          await powersync.writeTransaction(async (tx) => {
            await tx.execute(`
              UPDATE tasks 
              SET is_completed = 1, 
                  completed_at = ? 
              WHERE id = ?
            `, [now, id]);
          });
          console.log(`✅ Made a local-only update to task ${id} to prevent sync loop`);
        } catch (localError) {
          console.warn(`⚠️ Could not make local-only update:`, localError);
        }
      } else {
        // Fallback to simple update if we couldn't get the task data
        await powersync.execute(
          "UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?", 
          [now, id]
        );
        console.log(`✅ Task ${id} updated in PowerSync (fallback method)`);
      }
    } catch (updateError) {
      console.error(`❌ Error updating PowerSync for task ${id}:`, updateError);
      // Still try the simple update as a last resort
      await powersync.execute(
        "UPDATE tasks SET is_completed = 1, completed_at = ? WHERE id = ?", 
        [now, id]
      );
    }
    
    // Get all participants of the task to ensure they receive the update
    try {
      // Get all participants to notify them of the task completion
      const participants = await getTaskParticipants(id);
      console.log(`Found ${participants.length} participants for task ${id}`);
      
      // For each participant, we could potentially trigger a notification or 
      // other actions here. For now, we just log it.
      
      // Trigger immediate refresh for all clients with multiple attempts
      console.log(`Forcing immediate refresh for completed task ${id}`);
      await fetchParticipantTasks(false);
      
      // Set up multiple delayed refreshes to ensure sync happens
      for (const delay of [500, 1500, 3000]) {
        setTimeout(async () => {
          try {
            console.log(`Forcing additional data refresh after ${delay}ms for task ${id}`);
            await fetchParticipantTasks(false);
          } catch (e) {
            console.error(`Error in delayed refresh for task ${id}:`, e);
          }
        }, delay);
      }
    } catch (participantError) {
      console.error(`Error getting participants for task ${id}:`, participantError);
      // Don't fail the entire operation if just the participant part fails
    }
    
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
    try {
      await powersync.execute("DELETE FROM tasks");
      await powersync.execute("DELETE FROM ps_crud");
      console.log("✓ Tasks table cleared");
    } catch (e) {
      console.log("⚠️ Error clearing tasks table:", e);
    }
    
    // Make sure we're disconnected from PowerSync
    console.log("Disconnecting from PowerSync...");
    try {
      await powersync.disconnect();
      console.log("✓ PowerSync disconnected");
    } catch (e) {
      console.log("⚠️ Error disconnecting from PowerSync:", e);
    }
    
    // Wait a moment to ensure any in-progress syncs complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Delete all data from Supabase
    try {
      console.log("Deleting all participants from Supabase...");
      await supabase
        .from('participants')
        .delete()
        .neq('id', 0);
      
      console.log("Deleting all activities from Supabase...");
      await supabase
        .from('activities')
        .delete()
        .neq('id', 0);
      
      console.log("Deleting all notifications from Supabase...");
      await supabase
        .from('notifications')
        .delete()
        .neq('id', 0);
      
      console.log("Deleting all tasks from Supabase...");
      await supabase
        .from('tasks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
        
      console.log("✓ All data deleted from Supabase");
    } catch (e) {
      console.log("⚠️ Error clearing Supabase data:", e);
    }
    
    // COMPLETE RESET: Delete the PowerSync database file using multiple approaches
    try {
      console.log("🗑️ Deleting PowerSync database file to clear all pending sync operations...");
      
      // Try multiple methods to locate and delete the database file
      const FileSystem = require('expo-file-system');
      
      // Method 1: Try using internal _settings (most direct)
      try {
        const dbFilename = (powersync as any)._settings?.database?.dbFilename || 'nudge_tasks.db';
        const dbPath = `${FileSystem.documentDirectory}SQLite/${dbFilename}`;
        await FileSystem.deleteAsync(dbPath, { idempotent: true });
        console.log("✓ Database file deleted using method 1");
      } catch (err) {
        console.log("Method 1 failed:", err);
      }
      
      // Method 2: Try fixed path with known filename
      try {
        const dbPath = `${FileSystem.documentDirectory}SQLite/nudge_tasks.db`;
        await FileSystem.deleteAsync(dbPath, { idempotent: true });
        console.log("✓ Database file deleted using method 2");
      } catch (err) {
        console.log("Method 2 failed:", err);
      }
      
      // Method 3: Try deleting the entire SQLite directory
      try {
        const sqliteDir = `${FileSystem.documentDirectory}SQLite`;
        await FileSystem.deleteAsync(sqliteDir, { idempotent: true });
        console.log("✓ Entire SQLite directory deleted");
      } catch (err) {
        console.log("Method 3 failed:", err);
      }
      
      console.log("✅ Database file deletion attempts completed");
    } catch (e) {
      console.log("⚠️ Could not delete database file:", e);
    }
    
    // Check if we have a user with ID 1 in Supabase (solves foreign key constraint issues)
    console.log("👤 Checking if user with ID 1 exists in Supabase...");
    try {
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
    } catch (e) {
      console.log("⚠️ Error checking/creating user:", e);
    }
    
    console.log("✅ All tasks and related data deleted successfully");
    console.log("⚠️ IMPORTANT: You must RESTART THE APP to complete the reset process");
    
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
    isCompleted: row.is_completed === 1 || false,
    isPostponed: row.is_postponed === 1 || false,
    isArchived: row.is_archived === 1 || false,
    postponedCount: row.postponed_count,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    postponedAt: row.postponed_at,
    archivedAt: row.archived_at,
    creatorId: row.creator_id,
    category: row.category,
  };
};

// Hook to get all active tasks - using PowerSync's reactive approach
export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // SQL query for active tasks, ordered by priority - use a stronger WHERE clause
  const activeTasksQuery = `
    SELECT * FROM tasks 
    WHERE is_completed = 0 
      AND is_archived = 0
      AND (completed_at IS NULL OR completed_at = '')
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
    
    // Set up a periodic refresh for tasks - increased frequency to ensure faster updates of completed tasks
    const refreshIntervalId = setInterval(() => {
      if (isMounted) {
        console.log("⏰ Background task refresh triggered");
        // Run in the background without setting loading state to true
        fetchParticipantTasks(true).catch(e => {
          console.error("Error in background refresh:", e);
        });
      }
    }, 10000); // 10 second refresh interval
    
    // Trigger a one-time cleanup of any inconsistent tasks
    const cleanupInconsistentTasks = async () => {
      try {
        // Fix any tasks that might be inconsistent in local database
        // This runs once at component mount
        await powersync.execute(`
          UPDATE tasks 
          SET is_completed = 1 
          WHERE completed_at IS NOT NULL AND completed_at != '' AND is_completed = 0
        `);
        console.log("🧹 Cleaned up any inconsistent task completion status");
      } catch (e) {
        console.error("Error cleaning up tasks:", e);
      }
    };
    
    cleanupInconsistentTasks();
    
    const initTasks = async () => {
      try {
        // First fetch tasks including ones where the user is a participant from Supabase
        await fetchParticipantTasks(false);
        
        // Then set up a watcher for the PowerSync database using the iterator pattern
        const watcher = powersync.watch(activeTasksQuery);
        const iterator = watcher[Symbol.asyncIterator]();
        
        // Get initial data
        const initialResult = await powersync.execute(activeTasksQuery);
        if (initialResult.rows?._array && isMounted) {
          const initialTasks = initialResult.rows._array.map(convertTaskFromDatabase);
          
          // MULTIPLE LAYERS OF FILTERING for safety:
          // 1. SQL query already filters is_completed = 0
          // 2. Additional JavaScript filter for isCompleted
          // 3. Additional filter for completedAt
          const filteredTasks = initialTasks
            .filter(task => !task.isCompleted)
            .filter(task => !task.completedAt);
            
          console.log(`📊 Initial tasks loaded: ${initialTasks.length}, filtered: ${filteredTasks.length}`);
          setTasks(filteredTasks);
          setLoading(false);
        }
        
        // Define a function to process results from the watcher
        const processNext = async () => {
          try {
            const { value: result, done } = await iterator.next();
            if (done) return;
            
            if (result.rows?._array && isMounted) {
              const updatedTasks = result.rows._array.map(convertTaskFromDatabase);
              
              // MULTIPLE LAYERS OF FILTERING for safety:
              // 1. SQL query already filters is_completed = 0
              // 2. Additional JavaScript filter for isCompleted
              // 3. Additional filter for completedAt
              const filteredTasks = updatedTasks
                .filter(task => !task.isCompleted)
                .filter(task => !task.completedAt);
                
              console.log(`📊 Watch update - ${updatedTasks.length} tasks, filtered: ${filteredTasks.length}`);
              setTasks(filteredTasks);
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
    let isMounted = true;

    // Initial query and watch setup
    const setupWatcher = async () => {
      try {
        // Get initial data from PowerSync
        const result = await powersync.execute(sql);
        if (result.rows?._array && isMounted) {
          const tasksList = result.rows._array.map(toAppTask);
          console.log("✅ Found", tasksList.length, "completed tasks in PowerSync");
          setTasks(tasksList);
          // Don't set loading to false until we check Supabase as well
        }

        // Also fetch completed tasks from Supabase to ensure we're up to date
        const currentUser = await getCurrentUser();
        if (currentUser) {
          const userId = Number(currentUser.id);

          console.log("🔍 Fetching completed tasks from Supabase...");
          
          // Get completed tasks created by this user
          const { data: creatorTasks, error: creatorError } = await supabase
            .from('tasks')
            .select('*')
            .eq('creator_id', userId)
            .eq('is_completed', 1);
            
          // Get all task IDs where user is a participant
          const { data: participantData } = await supabase
            .from('participants')
            .select('task_id')
            .eq('user_id', userId);
          
          let participantTaskIds: string[] = [];
          if (participantData && participantData.length > 0) {
            participantTaskIds = participantData
              .map(p => p.task_id)
              .filter(Boolean);
          }
          
          let participantTasks: any[] = [];
          if (participantTaskIds.length > 0) {
            const { data: tasks } = await supabase
              .from('tasks')
              .select('*')
              .in('id', participantTaskIds)
              .eq('is_completed', 1);
              
            participantTasks = tasks || [];
          }
          
          // Combine all tasks and remove duplicates
          const allTasks = [...(creatorTasks || []), ...participantTasks];
          const uniqueTasks = allTasks.filter((task, index, self) => 
            index === self.findIndex((t) => t.id === task.id)
          );
          
          console.log(`🔄 Found ${uniqueTasks.length} completed tasks in Supabase`);
          
          // Insert these tasks into PowerSync
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
              1, // is_completed is always 1 for these tasks
              task.is_postponed ? 1 : 0
            ]);
          }
          
          // Now get all completed tasks from PowerSync after syncing
          const updatedResult = await powersync.execute(sql);
          if (updatedResult.rows?._array && isMounted) {
            const updatedTasks = updatedResult.rows._array.map(toAppTask);
            console.log("✅ Now found", updatedTasks.length, "completed tasks after Supabase sync");
            setTasks(updatedTasks);
          }
        }
        
        // Now set loading to false after both PowerSync and Supabase checks
        if (isMounted) {
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

            if (result.rows?._array && isMounted) {
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
          console.log("🔒 Cleaning up completed tasks watcher");
        };
      } catch (error) {
        console.error("❌ Error setting up completed tasks watcher:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    setupWatcher();

    // Cleanup function
    return () => {
      isMounted = false;
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
      // Handle nested user object safely with optional chaining and type checking
      const userData = p.users && typeof p.users === 'object' ? p.users : null;
      const firstName = userData && 'first_name' in userData ? userData.first_name : 'Unknown';
      const lastName = userData && 'last_name' in userData ? userData.last_name : '';
      console.log(`  ${i+1}. Participant ID: ${p.id}, Role: ${p.role}, User: ${firstName} ${lastName} (ID: ${p.user_id})`);
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

// Mark a task as archived
export const archiveTask = async (id: string): Promise<boolean> => {
  console.log("📁 Archiving task:", id);
  try {
    // First check if current user is the task owner
    const userRole = await getCurrentUserRoleForTask(id);
    console.log(`User role for task ${id}: ${userRole}`);
    
    if (userRole !== 'owner') {
      console.error("❌ Only task owners can archive tasks");
      return false;
    }

    const now = new Date().toISOString();
    
    // Update in Supabase to ensure data consistency
    const { error } = await supabase
      .from('tasks')
      .update({ 
        is_archived: 1, 
        archived_at: now 
      })
      .eq('id', id);
      
    if (error) {
      console.error("Failed to archive task in Supabase:", error);
      return false;
    }
    
    console.log(`📁 Task ${id} archived in Supabase at ${now}`);
    
    // Then update in local PowerSync database for immediate UI response
    const sql = "UPDATE tasks SET is_archived = 1, archived_at = ? WHERE id = ?";
    await powersync.execute(sql, [now, id]);
    
    console.log(`📁 Task ${id} also archived in PowerSync`);
    
    return true;
  } catch (error: any) {
    console.error(
      "❌ Failed to archive task:",
      error?.message || "Unknown error"
    );
    throw error;
  }
};

// Hook to fetch archived tasks
export const useArchivedTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    console.log("🔍 Setting up archived tasks watcher...");
    let isMounted = true;
    
    // Function to set up watchers for archived tasks
    const setupWatcher = async () => {
      try {
        // Get all archived tasks, whether completed or not
        const sql = `
          SELECT * FROM tasks 
          WHERE is_archived = 1
          ORDER BY archived_at DESC
        `;
        
        // First get tasks from PowerSync directly
        const result = await powersync.execute(sql);
        
        // Extract and convert tasks from the result
        if (result.rows?._array && isMounted) {
          const archivedTasks = result.rows._array.map(toAppTask);
          console.log("📁 Found", archivedTasks.length, "archived tasks in PowerSync");
          setTasks(archivedTasks);
        }
        
        // Also try to fetch tasks from Supabase to ensure all archived tasks are retrieved
        const { data: supabaseArchivedTasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('is_archived', 1)
          .order('archived_at', { ascending: false });
          
        if (error) {
          console.error("Error fetching archived tasks from Supabase", error);
        } else if (supabaseArchivedTasks?.length && isMounted) {
          console.log("📁 Found", supabaseArchivedTasks.length, "archived tasks in Supabase");
          
          // Convert to app task format
          const convertedTasks = supabaseArchivedTasks.map(task => ({
            id: task.id,
            title: task.title || "",
            description: task.description || "",
            priority: (task.priority as "high" | "medium" | "low") || "medium",
            isCompleted: Boolean(task.is_completed),
            isPostponed: Boolean(task.is_postponed),
            isArchived: true, // These are all archived
            postponedCount: task.postponed_count || 0,
            createdAt: task.created_at || new Date().toISOString(),
            completedAt: task.completed_at || null,
            postponedAt: task.postponed_at || null,
            archivedAt: task.archived_at || null,
            creatorId: task.creator_id || null,
            category: task.category || null,
          }));
          
          // Merge with existing tasks, removing duplicates
          const allTaskIds = new Set(tasks.map(task => task.id));
          const uniqueTasks = convertedTasks.filter(task => !allTaskIds.has(task.id));
          
          if (uniqueTasks.length) {
            console.log("📁 Adding", uniqueTasks.length, "unique archived tasks from Supabase");
            
            // Insert these tasks into PowerSync
            for (const task of uniqueTasks) {
              await powersync.execute(`
                INSERT OR REPLACE INTO tasks (
                  id, title, description, priority, created_at, completed_at, postponed_at, 
                  postponed_count, creator_id, category, is_completed, is_postponed, is_archived, archived_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                task.id,
                task.title,
                task.description,
                task.priority,
                task.createdAt,
                task.completedAt,
                task.postponedAt,
                task.postponedCount || 0,
                task.creatorId,
                task.category,
                task.isCompleted ? 1 : 0,
                task.isPostponed ? 1 : 0,
                1, // is_archived is always 1 for these tasks
                task.archivedAt
              ]);
            }
            
            // Now get all archived tasks from PowerSync after syncing
            const updatedResult = await powersync.execute(sql);
            if (updatedResult.rows?._array && isMounted) {
              const updatedTasks = updatedResult.rows._array.map(toAppTask);
              console.log("✅ Now found", updatedTasks.length, "archived tasks after Supabase sync");
              setTasks(updatedTasks);
            }
          }
        }
        
        // Set loading to false after both PowerSync and Supabase checks
        if (isMounted) {
          setLoading(false);
        }
        
        // Set up watcher for changes
        const watcher = powersync.watch(sql);
        
        // Create async iterator
        const iterator = watcher[Symbol.asyncIterator]();
        
        // Poll for changes
        const poll = async () => {
          try {
            const { value } = await iterator.next();
            
            if (value && isMounted) {
              const watchedTasks = value.rows._array.map(toAppTask);
              setTasks(watchedTasks);
              console.log("📊 Updated archived tasks list:", watchedTasks.length, "tasks");
            }
            
            if (isMounted) {
              setTimeout(poll, POLL_INTERVAL_MS);
            }
          } catch (err: any) {
            if (isMounted) {
              console.error("Error in archived tasks watcher:", err);
              setError(err);
              // Try to restart polling after a delay
              setTimeout(poll, POLL_INTERVAL_MS * 5);
            }
          }
        };
        
        // Start polling
        poll();
        
      } catch (err: any) {
        console.error("Failed to set up archived tasks watcher:", err);
        if (isMounted) {
          setError(err);
          setLoading(false);
        }
      }
    };
    
    setupWatcher();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  return { tasks, loading, error };
};
