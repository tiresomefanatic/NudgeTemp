import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import LaterStackTaskCard from "@/components/tasks/LaterStackTaskCard";
import { useArchivedTasks, batchGetTaskParticipants } from "@/lib/powersync/taskService";
import { Ionicons } from "@expo/vector-icons";
import { Task, TaskParticipant } from "@/types/task";

export default function ArchiveScreen() {
  const { tasks: archivedTasks, loading, error } = useArchivedTasks();
  const [participantsMap, setParticipantsMap] = useState<Record<string, TaskParticipant[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // Load participants for all tasks
  useEffect(() => {
    if (!archivedTasks.length) {
      setLoadingParticipants(false);
      return;
    }
    
    const fetchParticipants = async () => {
      try {
        setLoadingParticipants(true);
        const taskIds = archivedTasks.map(task => task.id);
        const participants = await batchGetTaskParticipants(taskIds);
        setParticipantsMap(participants);
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoadingParticipants(false);
      }
    };
    
    fetchParticipants();
  }, [archivedTasks]);
  
  const navigateBack = () => {
    router.back();
  };
  
  const navigateToNotifications = () => {
    router.push("/notifications" as any);
  };
  
  // Helper function to get participant initials
  const getParticipantInitials = (task: Task): string[] => {
    if (loadingParticipants) return [];
    
    const participants = participantsMap[task.id] || [];
    
    // Extract the first letter from participant names
    return participants.map(participant => {
      if (participant.user?.first_name) {
        return participant.user.first_name.charAt(0).toUpperCase();
      }
      return participant.user?.email?.charAt(0).toUpperCase() || '?';
    });
  };
  
  // Helper function to get creator's name
  const getCreatorName = (task: Task): string => {
    if (!task.creatorId) return "Unknown";
    
    // Look for creator in participants
    const participants = participantsMap[task.id] || [];
    const creatorParticipant = participants.find(p => p.user_id === task.creatorId);
    
    if (creatorParticipant?.user) {
      // Format user name directly
      const user = creatorParticipant.user;
      if (user.first_name && user.last_name) {
        return `${user.first_name} ${user.last_name}`;
      } else if (user.first_name) {
        return user.first_name;
      } else if (user.email) {
        return user.email.split('@')[0];
      }
    }
    
    return "Owner";
  };

  // Helper function to get owner's initial
  const getOwnerInitial = (task: Task): string => {
    if (!task.creatorId) return "?";
    const participants = participantsMap[task.id] || [];
    const creatorParticipant = participants.find(p => p.user_id === task.creatorId);
    if (creatorParticipant?.user?.first_name) {
      return creatorParticipant.user.first_name.charAt(0).toUpperCase();
    }
    if (creatorParticipant?.user?.email) {
      return creatorParticipant.user.email.charAt(0).toUpperCase();
    }
    return "?";
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header inside SafeAreaView */}
      {!loading && (
        <RNSafeAreaView edges={['top']} style={styles.safeHeader}>
          <View style={styles.customHeader}>
            <TouchableOpacity style={styles.headerIconLeft} onPress={navigateBack}>
              <Image
                source={require("@/assets/icons/LeftArrow.png")}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
            <View style={styles.headerTitleLeft}>
              <Text style={styles.headerTitle}>Archive</Text>
            </View>
            <View style={styles.headerIconsRight}>
              <TouchableOpacity onPress={navigateToNotifications}>
                <Image source={require("@/assets/icons/notification-bell.png")} style={{ width: 32, height: 32 }} resizeMode="contain" />
              </TouchableOpacity>
            </View>
          </View>
        </RNSafeAreaView>
      )}

      {/* Content container with task cards */}
      <View style={styles.contentContainer}>
        {loading || loadingParticipants ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066ff" />
            <Text style={styles.loadingText}>Loading archived tasks...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Error loading archived tasks</Text>
            <Text style={styles.errorDetails}>{error.message}</Text>
          </View>
        ) : archivedTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="archive-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No archived tasks</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {archivedTasks.map(task => {
              return (
                <View
                  key={task.id}
                  style={styles.taskContainer}
                >
                  <LaterStackTaskCard
                    title={task.title}
                    userName={getCreatorName(task)}
                    date={new Date(task.archivedAt || task.createdAt || new Date().toISOString()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    participants={getParticipantInitials(task)}
                    ownerInitial={getOwnerInitial(task)}
                    taskId={task.id} 
                  />
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  safeHeader: {
    backgroundColor: '#fff',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0,
    position: 'relative',
    paddingHorizontal: 0, 
  },
  headerIconLeft: {
    marginLeft: 16,
    marginRight: 0,
    width: 32,
    height: 32,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  headerTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flex: 1,
  },
  headerIconsRight: {
    flexDirection: 'row',
    marginRight: 16,
  },
  headerTitle: {
    fontFamily: 'Sharpie',
    fontWeight: '400',
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.15,
    color: '#3800FF',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  taskContainer: {
    marginBottom: 8,
  },
}); 