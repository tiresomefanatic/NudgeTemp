import { Redirect } from 'expo-router';

export default function Index() {
  // This redirects directly to the tasks screen
  return <Redirect href="/(tabs)/tasks" />;
} 