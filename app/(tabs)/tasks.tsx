import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useHeaderHeight } from "@react-navigation/elements";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

import TaskDeck from "@/components/tasks/TaskDeck";
import { Task } from "@/types/task";
import {
  useTasks,
  createTask,
  completeTask,
  postponeTask,
  nudgeTask,
  clearAllTasks,
  debugTaskParticipants,
} from "@/lib/powersync/taskService";
import { OfflineModeToggle } from "@/components/ui/OfflineModeToggle";
import { usePowerSyncApp } from "@/lib/powersync/provider";
import AddTaskCard from "@/components/tasks/AddTaskCard";
import { useAuth } from "@/lib/auth/AuthContext";
import DrawerMenu from "@/components/ui/DrawerMenu";

export default function TasksScreen() {
  // Use PowerSync hooks to get tasks
  const { tasks, loading } = useTasks();
  const { isConnected, offlineMode } = usePowerSyncApp();
  const headerHeight = useHeaderHeight();
  const [isClearing, setIsClearing] = useState(false);
  const { signOut } = useAuth();
  
  // Add drawer state
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Remove modal state, add inline card state
  const [showAddCard, setShowAddCard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // AddTaskCard state lifted up
  const [addTitle, setAddTitle] = useState("");
  const [addDetails, setAddDetails] = useState("");
  const [contributorIds, setContributorIds] = useState<number[]>([]);

  const handleLogout = async () => {
    try {
      Haptics.selectionAsync();
      await signOut();
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Error", "Failed to log out. Please try again.");
    }
  };

  // Toggle drawer
  const toggleDrawer = () => {
    Haptics.selectionAsync();
    setDrawerVisible(!drawerVisible);
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      const success = await completeTask(task.id);
      
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // Show alert that user is not allowed to complete this task
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Action Not Allowed",
          "Only the task owner can mark a task as complete.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error completing task:", error);
      Alert.alert("Error", "Failed to complete task");
    }
  };

  // Navigate to later stack screen
  const navigateToLaterStack = () => {
    Haptics.selectionAsync();
    router.push("/later-stack" as any);
  };

  const navigateToNotifications = () => {
    Haptics.selectionAsync();
    router.push("/notifications" as any);
  };

  const handlePostponeTask = async (task: Task) => {
    try {
      await postponeTask(task.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.error("Error postponing task:", error);
      Alert.alert("Error", "Failed to postpone task");
    }
  };

  const handleFinishAllTasks = () => {
    // Just trigger haptic feedback without showing any alert
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // No Alert.alert dialog
  };

  // Navigate to reset screen
  const navigateToResetScreen = () => {
    Haptics.selectionAsync();
    router.push("/reset");
  };

  // Handle clearing all tasks from the database
  const handleClearAllTasks = async () => {
    try {
      setIsClearing(true);
      await clearAllTasks();
      Alert.alert("Success", "All tasks have been cleared");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Failed to clear tasks:", error);
      Alert.alert("Error", "Failed to clear tasks");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsClearing(false);
    }
  };

  // Confirm clearing all tasks
  const confirmClearAllTasks = () => {
    Alert.alert(
      "Clear All Tasks",
      "Are you sure you want to delete all tasks? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: handleClearAllTasks,
        },
      ]
    );
  };

  const handleNudgeTask = async (task: Task) => {
    try {
      // Debug the task participants first
      await debugTaskParticipants(task.id);
      
      const success = await nudgeTask(task.id);
      
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          "Task Nudged",
          `You've nudged "${task.title}". This will remind collaborators about this task.`,
          [{ text: "OK" }]
        );
      } else {
        // Show alert that user is not allowed to nudge this task
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Action Not Allowed",
          "Only collaborators with 'nudger' role can nudge a task. Task owners cannot nudge their own tasks.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error nudging task:", error);
      Alert.alert("Error", "Failed to nudge task");
    }
  };

  // Get counts of completed and postponed tasks for the stats display
  const completedCount = tasks.filter((task) => task.isCompleted).length;
  const postponedCount = tasks.filter((task) => task.isPostponed).length;

  // New handler for AddTaskCard
  const handleCreateTask = async () => {
    if (!addTitle.trim()) return;
    
    // Store task data before clearing the form
    const taskData = {
      title: addTitle,
      description: addDetails,
      priority: "medium" as "medium" | "low" | "high",
      createdAt: new Date().toISOString(),
      isCompleted: false,
      isPostponed: false,
      postponedCount: 0,
    };
    const taskContributorIds = [...contributorIds];
    
    // Immediately navigate away for better UX
    setShowAddCard(false);
    setAddTitle("");
    setAddDetails("");
    setContributorIds([]);
    
    // Trigger haptic feedback for immediate response
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Perform the API call in the background
    setIsSaving(true);
    try {
      await createTask(taskData, taskContributorIds);
    } catch (error) {
      Alert.alert("Error", "Failed to create task. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setShowAddCard(false);
    setAddTitle("");
    setAddDetails("");
    setContributorIds([]);
  };

  // Compose tasks for deck
  const deckTasks = showAddCard
    ? [
        {
          id: "add",
          title: addTitle,
          description: addDetails,
          priority: "medium" as const,
          isCompleted: false,
          isPostponed: false,
          postponedCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...tasks,
      ]
    : tasks;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Drawer Menu */}
      <DrawerMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {/* Header inside SafeAreaView */}
      <RNSafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.customHeader}>
          <TouchableOpacity style={styles.headerIconLeft} onPress={toggleDrawer}>
            <Image
              source={require("@/assets/icons/hamburger.png")}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.nudgeTitle}>nudge</Text>
          </View>
          <View style={styles.headerIconsRight}>
            <TouchableOpacity onPress={navigateToNotifications}>
              <Image source={require("@/assets/icons/notification-bell.png")} style={{ width: 32, height: 32 }} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={26} color="#3800FF" />
            </TouchableOpacity>
          </View>
        </View>
      </RNSafeAreaView>

      <View style={styles.deckContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#0066ff" />
        ) : deckTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Image 
              source={require("@/assets/EmptyTask.png")} 
              style={styles.emptyStateImage} 
              resizeMode="contain"
            />
            <Text style={styles.emptyStateText}>
              Your task list is empty. Add one and start nudging!
            </Text>
          </View>
        ) : (
          <TaskDeck
            tasks={deckTasks}
            onComplete={handleCompleteTask}
            onPostpone={handlePostponeTask}
            onNudge={handleNudgeTask}
            onFinish={handleFinishAllTasks}
            addTaskCardProps={showAddCard ? {
              title: addTitle,
              setTitle: setAddTitle,
              details: addDetails,
              setDetails: setAddDetails,
              contributorIds: contributorIds,
              setContributorIds: setContributorIds,
              onSave: handleCreateTask,
              onDiscard: handleDiscard,
              saving: isSaving,
            } : undefined}
          />
        )}
      </View>

      {/* Add Task Buttons absolutely at the bottom of the screen */}
      {showAddCard && (
        <View style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 30, 
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginHorizontal: 24,
          zIndex: 20,
          gap: 8,
        }}>
          <TouchableOpacity
            style={{
              display: 'flex',
              paddingVertical: 12,
              paddingHorizontal: 16,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#7267FF',
              backgroundColor: '#fff',
              marginRight: 0,
            }}
            onPress={handleDiscard}
          >
            <Text style={{
              color: '#7267FF',
              fontFamily: 'Pally',
              fontSize: 16,
              fontWeight: '400',
              lineHeight: 20,
              letterSpacing: 0,
            }}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              display: 'flex',
              paddingVertical: 12,
              paddingHorizontal: 16,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              borderRadius: 12,
              backgroundColor: '#3800FF',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 4,
              marginLeft: 0,
            }}
            onPress={handleCreateTask}
            disabled={!addTitle.trim() || isSaving}
          >
            <Text style={{
              color: '#fff',
              fontFamily: 'Pally',
              fontSize: 16,
              fontWeight: '400',
              lineHeight: 20,
              letterSpacing: 0,
            }}>Create task</Text>
          </TouchableOpacity>
        </View>
      )}

       <View style={styles.footer}>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={navigateToResetScreen}
        >
          <Ionicons name="trash-outline" size={16} color="#ff4d4f" />
          <Text style={styles.resetButtonText}>Reset Database</Text>
        </TouchableOpacity>
      </View> 

      {/* Add Task Button */}
      {!showAddCard && (
        <TouchableOpacity
          style={styles.nudgeFab}
          onPress={() => setShowAddCard(true)}
          activeOpacity={0.85}
        >
          <Image source={require("@/assets/icons/plus.png")} style={{ width: 24, height: 24 }} resizeMode="contain" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 8,
  },
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  nudgeTitle: {
    fontFamily: 'Sharpie',
    fontWeight: '400', //540 not supported
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.15,
    textAlign: 'center',
    color: '#3800FF',
    flex: 1,
    width: '100%',
  },
  nudgeFab: {
    position: 'absolute',
    bottom: 38,
    left: '50%',
    marginLeft: -24, // Half the width to center it
    width: 48,
    height: 48,
    padding: 12,
    borderRadius: 40,
    backgroundColor: '#3800FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    display: 'flex',
    gap: 8,
    zIndex: 20,
  },

  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 77, 79, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 16,
  },
  resetButtonText: {
    color: "#ff4d4f",
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  deckContainer: {
    flex: 1,
    alignItems: "center", // Center horizontally
    width: "100%",
    paddingHorizontal: 0,
    paddingBottom: 40,
    backgroundColor: '#F4F4F6',
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    elevation: 0,
  },
  pillIndicator: {
    alignSelf: 'center',
    marginTop: 16,
    backgroundColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 7,
    marginBottom: 2,
  },
  pillIndicatorText: {
    color: '#222',
    fontWeight: '600',
    fontSize: 16,
  },
  instructions: {
    fontSize: 13,
    color: '#bdbdbd',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 10,
    fontWeight: '400',
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyStateImage: {
    width: 189,
    height: 213,
    marginBottom: 24,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 40,
    fontWeight: "bold",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 8,
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 14,
    color: "#666",
  },
  addButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0066ff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  // New simplified modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  simplifiedModal: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  simpleModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
  },
  simpleModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  simpleFormContainer: {
    marginBottom: 20,
  },
  simpleInputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
  },
  simpleInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#fff",
    color: "#000",
  },
  simplePriorityButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  simplePriorityButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  simplePriorityButtonSelected: {
    borderWidth: 2,
    borderColor: "#666",
  },
  createButton: {
    backgroundColor: "#0066ff",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  createButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  saveButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  logoutButton: {
    marginLeft: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
