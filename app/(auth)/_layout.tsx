import React from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';

export default function AuthLayout() {
  const { session, user } = useAuth();
  const router = useRouter();
  
  // If user is already authenticated AND has a name, redirect to the tasks screen
  useEffect(() => {
    if (session && user?.user_metadata?.full_name) {
      router.replace('/(tabs)/tasks');
    } 
    // If there's a session but no full_name, and we are not already on enter-name, 
    // it implies OTP was successful, so AuthContext should handle navigation to enter-name.
    // If no session, user stays in the auth flow.
  }, [session, user, router]);

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
        <Stack.Screen name="enter-name" />
        <Stack.Screen name="index" redirect={session && user?.user_metadata?.full_name ? true : false} />
      </Stack>
    </>
  );
}
