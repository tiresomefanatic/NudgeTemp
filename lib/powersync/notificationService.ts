import { supabase } from "../supabase/client";
import { getCurrentUser } from "./userService";

export interface Notification {
  id: string;
  user: string;
  action: string;
  content: string;
  time: string;
  type: string;
}

export interface DatabaseNotification {
  id: number;
  user_id: number;
  activity_id: number;
  is_read: boolean;
  created_at: string;
  activity?: {
    id: number;
    task_id: string;
    participant_id: number;
    user_id: number;
    type: string;
    content: string | null;
    created_at: string;
    task?: {
      id: string;
      title: string;
    };
    user?: {
      id: number;
      first_name: string | null;
      last_name: string | null;
      email: string;
    };
  };
}

// Format the time difference between now and the created_at date
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec ago`;
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} min ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hrs ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
};

// Format the user's name
const formatUserName = (user: { first_name: string | null; last_name: string | null; email: string }): string => {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) {
    return user.first_name;
  }
  return user.email.split('@')[0];
};

// Convert database notification to app notification format
const convertNotification = (dbNotification: DatabaseNotification): Notification | null => {
  if (!dbNotification.activity || !dbNotification.activity.user || !dbNotification.activity.task) {
    return null;
  }
  
  const { activity } = dbNotification;
  
  // Ensure user object exists and has required properties
  if (!activity.user) {
    return null;
  }
  
  const userName = formatUserName(activity.user);
  let action = '';
  let type = '';
  
  if (activity.type === 'nudge') {
    action = 'gave you a friendly nudge about';
    type = 'friendly';
  } else if (activity.type === 'task_message') {
    action = 'commented on';
    type = 'message';
  }
  
  // Ensure task object exists and has required properties
  if (!activity.task || !activity.task.title) {
    return null;
  }
  
  return {
    id: dbNotification.id.toString(),
    user: userName,
    action,
    content: `"${activity.task.title}"`,
    time: formatTimeAgo(dbNotification.created_at),
    type
  };
};

// Fetch notifications for the current user
export const fetchNotifications = async (): Promise<{ current: Notification[], older: Notification[] }> => {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      console.error('No current user found');
      return { current: [], older: [] };
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        activity:activity_id (
          *,
          task:task_id (*),
          user:user_id (*)
        )
      `)
      .eq('user_id', currentUser.id)
      .eq('is_read', false) // Only fetch unread notifications
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching notifications:', error);
      return { current: [], older: [] };
    }
    
    const notifications = data
      .map(notification => convertNotification(notification as DatabaseNotification))
      .filter((n): n is Notification => n !== null);
    
    // Split notifications into current (less than 24 hours old) and older
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const current: Notification[] = [];
    const older: Notification[] = [];
    
    notifications.forEach(notification => {
      // Parse the time string to determine if it's recent or older
      if (notification.time.includes('sec ago') || 
          notification.time.includes('min ago') || 
          notification.time.includes('hrs ago')) {
        current.push(notification);
      } else {
        older.push(notification);
      }
    });
    
    return { current, older };
  } catch (error) {
    console.error('Error in fetchNotifications:', error);
    return { current: [], older: [] };
  }
};

// Mark a notification as read
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
      
    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    return false;
  }
};

// Delete a notification
export const deleteNotification = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);
      
    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    return false;
  }
}; 