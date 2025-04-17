import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';

export default function AuthLayout() {
  const { session } = useAuth();
  const router = useRouter();
  
  // If user is already authenticated, redirect to the main app
  useEffect(() => {
    if (session) {
      router.replace('/(tabs)');
    }
  }, [session, router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'white' },
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="confirm-email" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="index" redirect={session ? true : false} />
      </Stack>
    </>
  );
}
