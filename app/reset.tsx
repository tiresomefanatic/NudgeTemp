import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { clearAllTasks } from '@/lib/powersync/taskService';

export default function ResetScreen() {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAllTasks = async () => {
    try {
      setIsClearing(true);
      await clearAllTasks();
      Alert.alert(
        'Success', 
        'All tasks have been cleared from the database',
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
      'Clear All Tasks', 
      'Are you sure you want to delete all tasks? This action cannot be undone.', 
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
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
        <Text style={styles.title}>Database Reset Tool</Text>
        <Text style={styles.description}>
          Use this tool to clear all tasks from your local PowerSync database.
          This will also remove them from Supabase once sync is complete.
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
