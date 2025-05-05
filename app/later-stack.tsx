import React, { useState } from "react";
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
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import LaterStackTaskCard from "@/components/tasks/LaterStackTaskCard";
import { usePostponedTasks, unpostponeTask } from "@/lib/powersync/taskService";
import { Ionicons } from "@expo/vector-icons";
import { Task } from "@/types/task";

const { width } = Dimensions.get("window");
// Constants for swipe - commented out as per requirements
// const SWIPE_THRESHOLD = width * 0.3;


export default function LaterStackScreen() {

  const { tasks: postponedTasks, loading } = usePostponedTasks();
  // Commented out swipingItemId state as per requirements
  // const [swipingItemId, setSwipingItemId] = useState<string | null>(null);
  
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
      if (postponedTasks.length <= 1) {
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
  
  // Create swipe handler for a specific task - Commented out as per requirements
  /*
  const createSwipeHandler = (task: Task) => {
    // Animation values
    const position = new Animated.ValueXY();
    const opacity = new Animated.Value(1);
    
    // Create pan responder for this task
    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderGrant: () => {
        setSwipingItemId(task.id);
      },
      onPanResponderMove: (evt, gestureState) => {
        // Only allow right-to-left swipe (negative dx)
        if (gestureState.dx < 0) {
          position.setValue({ x: gestureState.dx, y: 0 });
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left - move to main tasks
          Animated.parallel([
            Animated.timing(position, {
              toValue: { x: -width, y: 0 },
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            })
          ]).start(async () => {
            // Move task back to main tasks
            await handleMoveToMainTasks(task.id);
            setSwipingItemId(null);
            
            // Reset the animation values after a delay to avoid visual glitches
            setTimeout(() => {
              position.setValue({ x: 0, y: 0 });
              opacity.setValue(1);
            }, 100);
          });
        } else {
          // Return to original position
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            tension: 40,
            useNativeDriver: true,
          }).start(() => setSwipingItemId(null));
        }
      }
    });
    
    return { position, opacity, panResponder };
  };
  */

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
              <Text style={styles.headerTitle}>Later stack</Text>
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
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066ff" />
            <Text style={styles.loadingText}>Loading all tasks...</Text>
          </View>
        ) : postponedTasks.length === 0 ? (
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
            {postponedTasks.map(task => {
              // Removed swipe handler for this task as per requirements
              // const { position, opacity, panResponder } = createSwipeHandler(task);
              
              return (
                <View
                  key={task.id}
                  style={styles.taskContainer}
                >
                  {/* Return to main tasks indicator - Removed as per requirements */}
                  {/* {swipingItemId === task.id && (
                    <View style={styles.actionIndicator}>
                      <Ionicons name="arrow-back" size={20} color="#39C7A5" />
                      <Text style={styles.actionText}>Move to main tasks</Text>
                    </View>
                  )} */}
                  
                  <LaterStackTaskCard
                    title={task.title}
                    userName={task.id.startsWith('a') ? 'Alice' : 'Sam'} // Mock user name based on ID for demo
                    date={new Date(task.postponedAt || '').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    participants={['A', 'S']} // Mock participants for demo
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