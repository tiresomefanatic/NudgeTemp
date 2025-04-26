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
  clearAllTasks,
} from "@/lib/powersync/taskService";
import { OfflineModeToggle } from "@/components/ui/OfflineModeToggle";
import { usePowerSyncApp } from "@/lib/powersync/provider";

// Much simpler task creation modal
const TaskCreationModal = ({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setTitle("");
      setDescription("");
      setPriority("medium");
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert("Error", "Task title is required");
      return;
    }

    setIsSaving(true);
    try {
      await createTask({
        title,
        description,
        priority,
        createdAt: new Date().toISOString(),
        isCompleted: false,
        isPostponed: false,
        postponedCount: 0,
      });

      // Success feedback and cleanup
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      console.error("Error creating task:", error);
      Alert.alert("Error", "Failed to create task. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.simplifiedModal}>
          {/* Modal Header */}
          <View style={styles.simpleModalHeader}>
            <Text style={styles.simpleModalTitle}>Create a New Task</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.simpleFormContainer}>
            {/* Title Field */}
            <Text style={styles.simpleInputLabel}>Title</Text>
            <TextInput
              style={styles.simpleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="What needs to be done?"
              placeholderTextColor="#999"
            />

            {/* Description Field */}
            <Text style={styles.simpleInputLabel}>Description (optional)</Text>
            <TextInput
              style={[
                styles.simpleInput,
                { height: 100, textAlignVertical: "top" },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add details about this task"
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />

            {/* Priority Selection */}
            <Text style={styles.simpleInputLabel}>Priority</Text>
            <View style={styles.simplePriorityButtons}>
              {["high", "medium", "low"].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.simplePriorityButton,
                    priority === p && styles.simplePriorityButtonSelected,
                    p === "high" && { backgroundColor: "#ffedee" },
                    p === "medium" && { backgroundColor: "#fff5e6" },
                    p === "low" && { backgroundColor: "#e6f7ff" },
                  ]}
                  onPress={() => setPriority(p as "high" | "medium" | "low")}
                >
                  <Text style={priority === p ? { fontWeight: "bold" } : {}}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.createButtonText}>Create Task</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function TasksScreen() {
  // Use PowerSync hooks to get tasks
  const { tasks, loading } = useTasks();
  const { isConnected, offlineMode } = usePowerSyncApp();
  const headerHeight = useHeaderHeight();
  const [isClearing, setIsClearing] = useState(false);

  // Task creation modal state
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleCompleteTask = async (task: Task) => {
    try {
      await completeTask(task.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    // Check for postponed tasks before showing "All Done!"
    const postponedCount = tasks.filter((task) => task.isPostponed).length;
    
    // Only show "All Done!" if there are no postponed tasks
    if (postponedCount === 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "All Done!",
        "You have completed all your tasks for today. Great job!"
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Tasks Complete",
        "You've completed your active tasks. There are still some tasks in your Later Stack."
      );
    }
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

  // Get counts of completed and postponed tasks for the stats display
  const completedCount = tasks.filter((task) => task.isCompleted).length;
  const postponedCount = tasks.filter((task) => task.isPostponed).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header inside SafeAreaView */}
      <RNSafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.customHeader}>
          <TouchableOpacity style={styles.headerIconLeft} onPress={navigateToLaterStack}>
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
            <TouchableOpacity>
              <Image source={require("@/assets/icons/calendar.png")} style={{ width: 32, height: 32 }} resizeMode="contain" />
            </TouchableOpacity>
            <TouchableOpacity>
              <Image source={require("@/assets/icons/notification-bell.png")} style={{ width: 32, height: 32 }} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </View>
      </RNSafeAreaView>

      <View style={styles.deckContainer}>
        {loading ? (
          <ActivityIndicator size="large" color="#0066ff" />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkbox-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>No tasks yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Tap the + button to add a new task
            </Text>
          </View>
        ) : (
          <>
            <TaskDeck
              tasks={tasks}
              onComplete={handleCompleteTask}
              onPostpone={handlePostponeTask}
              onFinish={handleFinishAllTasks}
            />
            <View style={styles.pillIndicator}>
              <Text style={styles.pillIndicatorText}>{`1 of ${tasks.length} (tap to view all)`}</Text>
            </View>
          </>
        )}
      </View>

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
      <TouchableOpacity
        style={styles.nudgeFab}
        onPress={() => setIsModalVisible(true)}
        activeOpacity={0.85}
      >
        
          <Image source={require("@/assets/icons/plus.png")} style={{ width: 24, height: 24 }} resizeMode="contain" />
      </TouchableOpacity>

      {/* Task Creation Modal */}
      <TaskCreationModal
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onSave={() => setIsModalVisible(false)}
      />
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
    fontWeight: '500', //540 not supported
    fontStyle: 'italic',
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
    right: 28,
    width: 48,
    height: 48,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1249D3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 7,
    zIndex: 10,
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
    backgroundColor: '#f7f7f7',
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
    backgroundColor: '#FFFFFF',
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
    alignItems: "center",
    justifyContent: "center",
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
});
