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
  Animated,
  PanResponder,
  Dimensions,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import LaterStackTaskCard from "@/components/tasks/LaterStackTaskCard";
import { useAllTasks, unpostponeTask, batchGetTaskParticipants, getTaskParticipants } from "@/lib/powersync/taskService";
import { Ionicons } from "@expo/vector-icons";
import { Task, TaskParticipant } from "@/types/task";
import { useAuth } from "@/lib/auth/AuthContext";
import { useUser, formatUserName, getUserInitial } from "@/lib/powersync/userService";

const { width } = Dimensions.get("window");
// Constants for swipe - commented out as per requirements
// const SWIPE_THRESHOLD = width * 0.3;


export default function LaterStackScreen() {
  const { session } = useAuth();
  const { tasks: allTasks, loading } = useAllTasks();
  const [participantsMap, setParticipantsMap] = useState<Record<string, TaskParticipant[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  
  // Redirect to auth if not logged in
  if (!session) {
    return <Redirect href="/(auth)" />;
  }

  // Load participants for all tasks
  useEffect(() => {
    if (!allTasks.length) return;
    
    const fetchParticipants = async () => {
      try {
        setLoadingParticipants(true);
        const taskIds = allTasks.map(task => task.id);
        const participants = await batchGetTaskParticipants(taskIds);
        setParticipantsMap(participants);
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoadingParticipants(false);
      }
    };
    
    fetchParticipants();
  }, [allTasks]);
  
  useEffect(() => {
    if (!loading && !loadingParticipants && !hasLoadedOnce) {
      setHasLoadedOnce(true);
    }
  }, [loading, loadingParticipants, hasLoadedOnce]);
  
  // Function to navigate back to the tasks screen
  const navigateBack = () => {
    Haptics.selectionAsync();
    router.back();
  };
  
  const navigateToNotifications = () => {
    Haptics.selectionAsync();
    router.push("/notifications" as any);
  };
  
  const handleMoveToMainTasks = async (taskId: string) => {
    try {
      await unpostponeTask(taskId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // If this was the last postponed task and we're unpostponing it,
      // navigate back to the main tasks screen to avoid UI issues
      if (allTasks.filter(t => t.isPostponed).length <= 1) {
        // Small delay to let the state update before navigating
        setTimeout(() => {
          router.back();
        }, 300);
      }
    } catch (error) {
      console.error("Error moving task to main tasks:", error);
      Alert.alert("Error", "Failed to move task back");
    }
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
      // Format user name directly without using formatUserName to avoid type errors
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
              <Text style={styles.headerTitle}>All tasks</Text>
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
        {!hasLoadedOnce ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066ff" />
            <Text style={styles.loadingText}>Loading all tasks...</Text>
          </View>
        ) : allTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No tasks</Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {allTasks.map(task => {
              return (
                <View
                  key={task.id}
                  style={styles.taskContainer}
                >
                  <LaterStackTaskCard
                    title={task.title}
                    userName={getCreatorName(task)}
                    date={new Date(task.postponedAt || task.createdAt || new Date().toISOString()).toLocaleDateString('en-US', {
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
    alignItems: 'center',
    marginRight: 16,
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Sharpie',
    fontWeight: '500',
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.15,
    color: '#3800FF',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollViewContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
    textAlign: 'center',
  },
  taskContainer: {
    position: 'relative',
  },
  actionIndicator: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: -1,
  },
  actionText: {
    color: '#39C7A5',
    marginLeft: 8,
    fontWeight: '600',
  },
}); 