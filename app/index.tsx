import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth/AuthContext';

export default function Index() {
  const { session } = useAuth();
  
  // Redirect to auth flow if not authenticated, otherwise to tasks
  return session ? <Redirect href="/(tabs)/tasks" /> : <Redirect href="/(auth)" />;
} 