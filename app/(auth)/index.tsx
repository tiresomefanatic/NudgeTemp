import { useEffect } from 'react';
import { Redirect, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../../lib/auth/AuthContext';

/**
 * This is the entry point for the authentication flow
 * It automatically redirects to login if not authenticated
 */
export default function AuthIndex() {
  const { session, loading } = useAuth();
  const rootNavigationState = useRootNavigationState();

  if (loading || !rootNavigationState?.key) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 20, fontSize: 16, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  // If user is authenticated, redirect to main app
  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise, redirect to login
  return <Redirect href="login" />;
}
