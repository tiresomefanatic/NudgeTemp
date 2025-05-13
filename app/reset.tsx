import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Redirect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { clearAllTasks } from '@/lib/powersync/taskService';
import { useAuth } from '@/lib/auth/AuthContext';
import { usePowerSyncApp } from '@/lib/powersync/provider';

export default function ResetScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { resetPowerSync } = usePowerSyncApp();
  const [isClearing, setIsClearing] = useState(false);

  // Redirect to auth if not logged in
  if (!session) {
    return <Redirect href="/(auth)" />;
  }

  const handleClearAllTasks = async () => {
    try {
      setIsClearing(true);
      
      // Step 1: Clear all tasks and delete database
      await clearAllTasks();
      
      // Step 2: Try to reset PowerSync connection
      try {
        console.log("🔄 Attempting to reset PowerSync connections...");
        const resetSuccess = await resetPowerSync();
        console.log(`PowerSync reset ${resetSuccess ? 'successful' : 'failed'}`);
      } catch (error) {
        console.error("Failed to reset PowerSync:", error);
      }
      
      Alert.alert(
        'Complete Reset Successful', 
        'All tasks have been cleared from the database.\n\n⚠️ IMPORTANT: You MUST RESTART THE APP NOW to complete the reset process.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to clear tasks:', error);
      Alert.alert('Error', 'Failed to clear tasks');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsClearing(false);
    }
  };
  
  const confirmClearAllTasks = () => {
    Alert.alert(
      'Complete Database Reset', 
      'This will delete ALL tasks and completely reset the database. You must restart the app afterward.\n\nThis action cannot be undone.', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset Everything', 
          style: 'destructive',
          onPress: handleClearAllTasks 
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      <View style={styles.content}>
        <Text style={styles.title}>Complete Database Reset</Text>
        <Text style={styles.description}>
          This tool will:
          {'\n\n'}• Clear all tasks from your local database
          {'\n'}• Delete the database file to remove pending sync
          {'\n'}• Fix any sync constraint issues
          {'\n'}• Remove all related data from Supabase
          {'\n\n'}⚠️ You MUST RESTART the app after reset ⚠️
        </Text>
        
        <TouchableOpacity
          style={styles.resetButton}
          onPress={confirmClearAllTasks}
          disabled={isClearing}
        >
          {isClearing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.resetButtonText}>Reset Database</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  resetButton: {
    backgroundColor: '#ff4d4f',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});
