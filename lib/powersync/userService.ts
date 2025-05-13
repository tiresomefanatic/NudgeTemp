import { supabase } from "../supabase/client";
import { useAuth } from "../auth/AuthContext";
import { useState, useEffect } from "react";

export interface User {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  created_at: string;
}

// Get the current logged-in user's data from the users table
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data: authUser } = await supabase.auth.getUser();
    
    if (!authUser.user) return null;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', authUser.user.email)
      .single();
    
    if (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
    
    return data as User;
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
};

// Get a list of all users (potential contributors)
export const getAllUsers = async (): Promise<User[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('first_name', { ascending: true });
    
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    
    return data as User[];
  } catch (error) {
    console.error('Error in getAllUsers:', error);
    return [];
  }
};

// Get a user by ID
export const getUserById = async (userId: number): Promise<User | null> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
    
    return data as User;
  } catch (error) {
    console.error('Error in getUserById:', error);
    return null;
  }
};

// Format user's name for display - utility function used across components
export const formatUserName = (user: User | null): string => {
  if (!user) return 'Unknown';
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  if (user.first_name) {
    return user.first_name;
  }
  return user.email.split('@')[0];
};

// Get initial letter for avatar
export const getUserInitial = (user: User | null): string => {
  if (!user) return '?';
  if (user.first_name) {
    return user.first_name.charAt(0).toUpperCase();
  }
  return user.email.charAt(0).toUpperCase();
};

// Hook to get the current user
export const useCurrentUser = () => {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching current user data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [authUser]);

  return { user, loading };
};

// Hook to get all users
export const useAllUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersData = await getAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Error fetching all users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return { users, loading };
};

// Hook to get a specific user by ID
export const useUser = (userId: number | null) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const userData = await getUserById(userId);
        setUser(userData);
      } catch (error) {
        console.error(`Error fetching user with ID ${userId}:`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  return { user, loading };
}; 