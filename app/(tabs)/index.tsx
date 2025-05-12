import { Redirect } from 'expo-router';

export default function TabsIndex() {
  // Redirect directly to the tasks screen
  return <Redirect href="/(tabs)/tasks" />;
}
