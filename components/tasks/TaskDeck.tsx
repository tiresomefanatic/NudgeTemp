import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  Dimensions,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  ActivityIndicator,
  Image,
  Easing,
} from "react-native";
import { Task } from "../../types/task";
import TaskCard from "./TaskCard";
import { powersync } from "@/lib/powersync/database";
import AddTaskCard from "./AddTaskCard";
import { getCurrentUserRoleForTask, batchGetTaskParticipants, getTaskParticipants } from "@/lib/powersync/taskService";
import { useCurrentUser } from "@/lib/powersync/userService";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85;

// Constants for swipe thresholds
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_UP_THRESHOLD = height * 0.15; // Threshold for upward swipe (nudge)
const SWIPE_DOWN_THRESHOLD = height * 0.15;
const ROTATION_ANGLE = 8;
const SPRING_CONFIG = { damping: 15, stiffness: 150 };

interface TaskDeckProps {
  tasks: Task[];
  onComplete: (task: Task) => void;
  onPostpone: (task: Task) => void;
  onNudge?: (task: Task) => void; // Callback for nudge action
  onArchive?: (task: Task) => void; // Callback for archive action
  onFinish?: () => void;
  addTaskCardProps?: any; // Props for AddTaskCard, if present
}

const TaskDeck: React.FC<TaskDeckProps> = ({
  tasks: initialTasks,
  onComplete,
  onPostpone,
  onNudge,
  onArchive,
  onFinish,
  addTaskCardProps,
}) => {
  // Active tasks in the current deck
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  // Tasks that have been postponed
  const [postponedTasks, setPostponedTasks] = useState<Task[]>([]);
  // Track current card index
  const [cardIndex, setCardIndex] = useState(0);
  // Track list vs deck view mode
  const [isListMode, setIsListMode] = useState(false);
  // Track if there are postponed tasks in the system
  const [hasPostponedTasks, setHasPostponedTasks] = useState(false);
  const [checkingPostponedTasks, setCheckingPostponedTasks] = useState(true);
  // Animation value for list transitions
  const listAnimationValue = useRef(new Animated.Value(0)).current;
  
  // User role tracking for each task
  const [userRoles, setUserRoles] = useState<Record<string, 'owner' | 'nudger' | null>>({});
  const [loadingRoles, setLoadingRoles] = useState(true);
  // Store participants data for all tasks
  const [participantsMap, setParticipantsMap] = useState<Record<string, any[]>>({});
  const [loadingParticipants, setLoadingParticipants] = useState(true);
  // Add a separate flag for initial loading vs. background refreshing
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { user: currentUser } = useCurrentUser();
  
  // Animation values for the card
  const position = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  // Animation value for transitions between cards
  const transitionAnimation = useRef(new Animated.Value(0)).current;
  // Track if a swipe animation is in progress to prevent interruptions
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  // Track which card is being animated out (-1 for none)
  const animatingCardIndex = useRef(-1);
  
  const rotateAnimValue = position.x.interpolate({
    inputRange: [-width * 0.7, 0, width * 0.7],
    outputRange: [`-${ROTATION_ANGLE}deg`, '0deg', `${ROTATION_ANGLE}deg`],
    extrapolate: 'clamp',
  });
  
  // Overlay opacity values
  const leftSwipeOverlayOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -20],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });
  
  const rightSwipeOverlayOpacity = position.x.interpolate({
    inputRange: [20, SWIPE_THRESHOLD],
    outputRange: [0, 0.5],
    extrapolate: 'clamp',
  });
  
  const upSwipeOverlayOpacity = position.y.interpolate({
    inputRange: [-SWIPE_UP_THRESHOLD * 1.5, -SWIPE_UP_THRESHOLD * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  
  // Add overlay opacity for downward swipe (archive)
  const downSwipeOverlayOpacity = position.y.interpolate({
    inputRange: [SWIPE_DOWN_THRESHOLD * 0.5, SWIPE_DOWN_THRESHOLD * 1.5],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const cardScale = position.y.interpolate({
    inputRange: [-height * 0.7, -SWIPE_UP_THRESHOLD, 0],
    outputRange: [0.85, 0.95, 1],
    extrapolate: 'clamp',
  });

  // Add animation refs for the entire stack
  const secondCardScale = useRef(new Animated.Value(0.97)).current;
  const secondCardTranslateY = useRef(new Animated.Value(-18)).current;
  const thirdCardScale = useRef(new Animated.Value(0.94)).current;
  const thirdCardTranslateY = useRef(new Animated.Value(-36)).current;
  const [isPromotingCards, setIsPromotingCards] = useState(false);

  // Batch fetch participants for all tasks
  const fetchParticipantsForAllTasks = useCallback(async (tasks: Task[], isRefresh = false) => {
    if (!tasks.length) return;
    
    if (!isRefresh) {
      console.log("🔄 Initial loading of participants started");
      setLoadingParticipants(true);
    } else {
      console.log("🔄 Background refresh of participants started");
    }
    
    try {
      // First prioritize loading the top card's participants for immediate display
      if (tasks[0] && tasks[0].id !== 'add') {
        const topTaskParticipants = await getTaskParticipants(tasks[0].id);
        setParticipantsMap(current => ({
          ...current,
          [tasks[0].id]: topTaskParticipants
        }));
      }
      
      // Then load all other tasks' participants in the background
      const taskIds = tasks.slice(1).map(task => task.id);
      if (taskIds.length > 0) {
        const participantsData = await batchGetTaskParticipants(taskIds);
        setParticipantsMap(current => ({
          ...current,
          ...participantsData
        }));
      }
    } catch (error) {
      console.error('Error prefetching participants:', error);
    } finally {
      setLoadingParticipants(false);
      if (!isRefresh) {
        console.log("🔄 Initial loading of participants completed");
        setIsInitialLoad(false);
      } else {
        console.log("🔄 Background refresh of participants completed");
      }
    }
  }, []);

  // Initialize the deck when we receive initialTasks
  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setActiveTasks([...initialTasks]);
      setPostponedTasks([]);
      setCardIndex(0);
      // Reset animation values
      position.setValue({ x: 0, y: 0 });
      transitionAnimation.setValue(0);
      setIsSwipeAnimating(false);
      animatingCardIndex.current = -1;
      
      // Set immediate optimistic permissions for the top task
      if (initialTasks[0]?.id !== 'add' && currentUser) {
        const topTask = initialTasks[0];
        const tempRoles = { ...userRoles };
        
        // If user is creator, they're the owner
        if (topTask.creatorId === currentUser.id) {
          tempRoles[topTask.id] = 'owner';
        } 
        // Otherwise, assume they might be a nudger for optimistic UI
        // The actual role will be updated when fetchUserRolesForTasks completes
        else if (topTask.creatorId !== currentUser.id) {
          tempRoles[topTask.id] = 'nudger';
        }
        
        setUserRoles(tempRoles);
      }
      
      // Fetch user roles and participants data concurrently
      // Use isInitialLoad state to determine if this is the first load
      const refreshing = !isInitialLoad;
      Promise.all([
        fetchUserRolesForTasks(initialTasks),
        fetchParticipantsForAllTasks(initialTasks, refreshing)
      ]);
    }
  }, [initialTasks, currentUser, fetchParticipantsForAllTasks, isInitialLoad]);
  
  // Function to fetch user roles for all tasks
  const fetchUserRolesForTasks = useCallback(async (tasks: Task[]) => {
    if (!currentUser) return;
    
    setLoadingRoles(true);
    const roles: Record<string, 'owner' | 'nudger' | null> = {};
    
    // Batch fetch approach - create an array of promises for all tasks
    const rolePromises = tasks
      .filter(task => task.id !== 'add')
      .map(async task => {
        try {
          const role = await getCurrentUserRoleForTask(task.id);
          return { taskId: task.id, role };
        } catch (error) {
          console.error('Error fetching role for task:', task.id, error);
          return { taskId: task.id, role: null };
        }
      });
    
    // Wait for all role fetches to complete
    const results = await Promise.all(rolePromises);
    
    // Convert results to the roles object
    results.forEach(result => {
      roles[result.taskId] = result.role;
    });
    
    setUserRoles(roles);
    setLoadingRoles(false);
  }, [currentUser]);
  
  // Check if user can complete a task with optimistic fallback
  const canCompleteTask = useCallback((taskId: string) => {
    // If roles are loading and this is the top card, optimistically allow
    if (loadingRoles && taskId === activeTasks[cardIndex]?.id) {
      // Default permissions for top card while loading: 
      // Allow complete if user created the task
      const task = activeTasks.find(t => t.id === taskId);
      if (task && task.creatorId === currentUser?.id) {
        return true;
      }
    }
    
    return userRoles[taskId] === 'owner';
  }, [userRoles, loadingRoles, activeTasks, cardIndex, currentUser]);
  
  // Check if user can nudge a task with optimistic fallback
  const canNudgeTask = useCallback((taskId: string) => {
    // If roles are loading and this is the top card, optimistically allow
    if (loadingRoles && taskId === activeTasks[cardIndex]?.id) {
      // Default permissions for top card while loading:
      // Allow nudge if user did NOT create the task (likely a nudger)
      const task = activeTasks.find(t => t.id === taskId);
      if (task && task.creatorId !== currentUser?.id) {
        return true;
      }
    }
    
    return userRoles[taskId] === 'nudger';
  }, [userRoles, loadingRoles, activeTasks, cardIndex, currentUser]);

  // Function to handle when a card is swiped left (postponed)
  const handleSwipedLeft = useCallback((index: number) => {
    // Get the task being postponed
    const taskToPostpone = activeTasks[index];

    // Call the parent's callback to mark the task as postponed
    onPostpone(taskToPostpone);
    
    // Update the active tasks array to ensure smooth transition
    // Use a callback to ensure we get the latest state
    setActiveTasks(currentTasks => {
      // Create a copy of the tasks
      const updatedTasks = [...currentTasks];
      // Move the swiped task to the end (for left swipe)
      if (index < updatedTasks.length) {
        const [removedTask] = updatedTasks.splice(index, 1);
        updatedTasks.push(removedTask);
      }
      return updatedTasks;
    });
    
    // Update the current index to show the next task
    setCardIndex(prevIndex => {
      const newIndex = prevIndex + 1;
      
      // Log to confirm we're showing the right data for the next card
      const nextTaskId = activeTasks[newIndex]?.id;
      if (nextTaskId && nextTaskId !== 'add') {
        console.log(`Next card will be task ${nextTaskId} - using prefetched data`);
      }
      
      return newIndex;
    });
    
    // Reset animation states after all state updates
    setIsSwipeAnimating(false);
    animatingCardIndex.current = -1;
  }, [activeTasks, onPostpone]);

  // Function to handle when a card is swiped right (completed)
  const handleSwipedRight = useCallback((index: number) => {
    // Task complete
    onComplete(activeTasks[index]);
    
    // Update the current index to show the next task
    setCardIndex(prevIndex => {
      const newIndex = prevIndex + 1;
      
      // Log to confirm we're showing the right data for the next card
      const nextTaskId = activeTasks[newIndex]?.id;
      if (nextTaskId && nextTaskId !== 'add') {
        console.log(`Next card will be task ${nextTaskId} - using prefetched data`);
      }
      
      return newIndex;
    });
    
    // Reset animation states after all state updates
    setIsSwipeAnimating(false);
    animatingCardIndex.current = -1;
  }, [activeTasks, onComplete]);

  // Function to handle when a card is swiped up (nudge)
  const handleSwipedUp = useCallback((index: number) => {
    // Check if the onNudge callback exists before calling it
    if (!onNudge) return;
    
    const taskToNudge = activeTasks[index];
    
    // Nudge the task
    onNudge(taskToNudge);
    
    // Update the current index to show the next task
    setCardIndex(prevIndex => {
      const newIndex = prevIndex + 1;
      
      // Log to confirm we're showing the right data for the next card
      const nextTaskId = activeTasks[newIndex]?.id;
      if (nextTaskId && nextTaskId !== 'add') {
        console.log(`Next card will be task ${nextTaskId} - using prefetched data`);
      }
      
      return newIndex;
    });
    
    // Reset animation states after all state updates
    setIsSwipeAnimating(false);
    animatingCardIndex.current = -1;
    
    // Return to center position smoothly
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [activeTasks, onNudge]);

  // Reset position after swipe
  const resetPosition = () => {
    // Only reset if we're not in the middle of a swipe animation
    if (!isSwipeAnimating) {
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  };

  // Modified to animate the entire stack (both 2nd and 3rd cards)
  const animateStackPromotion = useCallback(() => {
    setIsPromotingCards(true);
    return new Promise<void>((resolve) => {
      Animated.parallel([
        // Animate 2nd card to top position
        Animated.timing(secondCardScale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(secondCardTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        // Animate 3rd card to 2nd position
        Animated.timing(thirdCardScale, {
          toValue: 0.97,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(thirdCardTranslateY, {
          toValue: -18,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Reset animation values for next time
        secondCardScale.setValue(0.97);
        secondCardTranslateY.setValue(-18);
        thirdCardScale.setValue(0.94);
        thirdCardTranslateY.setValue(-36);
        setIsPromotingCards(false);
        resolve();
      });
    });
  }, [secondCardScale, secondCardTranslateY, thirdCardScale, thirdCardTranslateY]);

  // Add a function to check if user can archive the task (only owners can archive)
  const canArchiveTask = useCallback((taskId: string) => {
    return userRoles[taskId] === 'owner';
  }, [userRoles]);

  // Function to handle when a card is swiped down (archived)
  const handleSwipedDown = useCallback((index: number) => {
    // Check if the onArchive callback exists before calling it
    if (!onArchive) return;
    
    const taskToArchive = activeTasks[index];
    
    // Archive the task
    onArchive(taskToArchive);
    
    // Update the active tasks array to remove the archived task
    setActiveTasks(currentTasks => {
      // Create a copy of the tasks
      const updatedTasks = [...currentTasks];
      // Remove the archived task
      if (index < updatedTasks.length) {
        updatedTasks.splice(index, 1);
      }
      return updatedTasks;
    });
    
    // Update the current index to show the next task
    setCardIndex(prevIndex => {
      const newIndex = prevIndex;
      
      // Log to confirm we're showing the right data for the next card
      const nextTaskId = activeTasks[newIndex]?.id;
      if (nextTaskId && nextTaskId !== 'add') {
        console.log(`Next card will be task ${nextTaskId} - using prefetched data`);
      }
      
      return newIndex;
    });
    
    // Reset animation states after all state updates
    setIsSwipeAnimating(false);
    animatingCardIndex.current = -1;
    
    // Return to center position smoothly
    position.setValue({ x: 0, y: 0 });
  }, [activeTasks, onArchive]);

  // Modified completeSwipe to include downward swipe
  const completeSwipe = useCallback(
    async (direction: 'left' | 'right' | 'down', index: number, gesture: { dx: number, dy: number }) => {
      if (isSwipeAnimating) return;
      
      const task = activeTasks[index];
      
      // Check permissions for right swipe (complete)
      if (direction === 'right' && !canCompleteTask(task.id)) {
        // User is not allowed to complete this task, reset position
        resetPosition();
        return;
      }
      
      // Check permissions for down swipe (archive)
      if (direction === 'down' && !canArchiveTask(task.id)) {
        // User is not allowed to archive this task, reset position
        resetPosition();
        return;
      }
      
      setIsSwipeAnimating(true);
      animatingCardIndex.current = index;

      // Animate outgoing card
      let targetX = 0;
      let targetY = 0;
      
      if (direction === 'left' || direction === 'right') {
        targetX = direction === 'left' ? -width * 1.5 : width * 1.5;
        targetY = gesture.dy;
      } else if (direction === 'down') {
        targetX = gesture.dx;
        targetY = height * 1.5;
      }
      
      await new Promise<void>((resolve) => {
        Animated.timing(position, {
          toValue: { x: targetX, y: targetY },
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          resolve();
        });
      });

      // Animate full stack promotion if there are enough cards
      if (activeTasks.length > cardIndex + 1) {
        await animateStackPromotion();
      }

      // Reset position immediately before the state updates
      position.setValue({ x: 0, y: 0 });

      // Update state after animation is complete
      if (direction === 'left') {
        handleSwipedLeft(index);
      } else if (direction === 'right') {
        handleSwipedRight(index);
      } else if (direction === 'down') {
        handleSwipedDown(index);
      }
    }, [isSwipeAnimating, position, activeTasks, cardIndex, handleSwipedLeft, handleSwipedRight, handleSwipedDown, canCompleteTask, canArchiveTask]);

  // Create pan responder for swipe gestures
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (evt, gestureState) => {
      // Don't capture gestures for very small movements (likely scrolling)
      // Also don't capture if we're already animating a swipe
      return !isSwipeAnimating && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5);
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Don't capture if we're already animating a swipe
      if (isSwipeAnimating) return false;
      
      const currentTask = activeTasks[cardIndex];
      
      // For upward swipes (nudge), check if user is allowed to nudge
      if (gestureState.dy < -5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
        // Allow nudging if:
        // 1. User has nudger role, OR
        // 2. Roles are still loading and user is not the creator (likely a nudger)
        return !!(onNudge && (
          canNudgeTask(currentTask.id) || 
          (loadingRoles && currentTask.creatorId !== currentUser?.id)
        ));
      }
      
      // For downward swipes (archive), check if user is allowed to archive
      if (gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)) {
        // Allow archiving if:
        // 1. User has owner role, OR
        // 2. Roles are still loading and user is the creator (likely an owner)
        return !!(onArchive && (
          canArchiveTask(currentTask.id) || 
          (loadingRoles && currentTask.creatorId === currentUser?.id)
        ));
      }
      
      // For right swipes (complete), check if user is allowed to complete
      if (gestureState.dx > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)) {
        // Allow completing if:
        // 1. User has owner role, OR
        // 2. Roles are still loading and user is the creator (likely an owner)
        return !!(
          canCompleteTask(currentTask.id) || 
          (loadingRoles && currentTask.creatorId === currentUser?.id)
        );
      }
      
      // Always allow left swipes for postpone regardless of role
      return true;
    },
    onPanResponderMove: (_, gesture) => {
      // Don't move the card if we're already animating a swipe
      if (isSwipeAnimating) return;
      
      const currentTask = activeTasks[cardIndex];
      
      // For upward movement (nudge)
      if (gesture.dy < 0 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
        // Allow upward movement if user can nudge or if we're still loading roles for the top card
        if ((onNudge && canNudgeTask(currentTask.id)) || 
            (loadingRoles && currentTask.creatorId !== currentUser?.id)) {
          // Apply movement constraints to y-axis for better upward swipe behavior
          // Make upward movement more pronounced, but dampen it for more natural feel
          const dampenFactor = Math.min(1, Math.abs(gesture.dy) / (height * 0.6));
          const y = gesture.dy * (1 - (dampenFactor * 0.3));
          position.setValue({ x: gesture.dx, y });
        }
      } 
      // For downward movement (archive)
      else if (gesture.dy > 0 && Math.abs(gesture.dy) > Math.abs(gesture.dx)) {
        // Allow downward movement if user can archive or if we're still loading roles for the top card
        if ((onArchive && canArchiveTask(currentTask.id)) || 
            (loadingRoles && currentTask.creatorId === currentUser?.id)) {
          // Apply movement constraints to y-axis for better downward swipe behavior
          const dampenFactor = Math.min(1, Math.abs(gesture.dy) / (height * 0.6));
          const y = gesture.dy * (1 - (dampenFactor * 0.3));
          position.setValue({ x: gesture.dx, y });
        }
      } 
      // For right movement (complete)
      else if (gesture.dx > 0 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) {
        // Allow rightward movement if user can complete or if we're still loading roles for the top card
        if (canCompleteTask(currentTask.id) || 
            (loadingRoles && currentTask.creatorId === currentUser?.id)) {
          position.setValue({ x: gesture.dx, y: gesture.dy });
        }
      }
      // Always allow left movement (postpone)
      else {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      }
    },
    onPanResponderRelease: (_, gesture) => {
      // Don't handle release if we're already animating a swipe
      if (isSwipeAnimating) return;
      
      const currentTask = activeTasks[cardIndex];
      
      // Determine if the user can complete using optimistic permissions
      const canCompleteOptimistic = 
        canCompleteTask(currentTask.id) || 
        (loadingRoles && currentTask.creatorId === currentUser?.id);
        
      // Determine if the user can nudge using optimistic permissions
      const canNudgeOptimistic = 
        (onNudge && canNudgeTask(currentTask.id)) || 
        (loadingRoles && onNudge && currentTask.creatorId !== currentUser?.id);
        
      // Determine if the user can archive using optimistic permissions
      const canArchiveOptimistic = 
        (onArchive && canArchiveTask(currentTask.id)) || 
        (loadingRoles && onArchive && currentTask.creatorId === currentUser?.id);
      
      if (gesture.dx > SWIPE_THRESHOLD && canCompleteOptimistic) {
        // Swiped right - complete (only if user is allowed)
        completeSwipe('right', cardIndex, gesture);
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        // Swiped left - postpone (anyone can postpone)
        completeSwipe('left', cardIndex, gesture);
      } else if (gesture.dy < -SWIPE_UP_THRESHOLD && canNudgeOptimistic) {
        // Swiped up - nudge (only if user is allowed)
        // Prevent interruption of this animation
        setIsSwipeAnimating(true);
        animatingCardIndex.current = cardIndex;
        
        // Create a sequence of animations for a more polished effect
        Animated.parallel([
          // Move card upward
          Animated.sequence([
            // First move up with acceleration
            Animated.timing(position, {
              toValue: { x: gesture.dx, y: -height * 0.6 },
              duration: 250,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            // Then move further up
            Animated.timing(position, {
              toValue: { x: gesture.dx, y: -height },
              duration: 150,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            })
          ]),
          // Fade out the card as it moves up
          Animated.timing(cardOpacity, {
            toValue: 0,
            duration: 400, // Total duration of the fade-out effect
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Then handle the nudge action and reset position
          handleSwipedUp(cardIndex);
          // Reset opacity for next time
          cardOpacity.setValue(1);
        });
      } else if (gesture.dy > SWIPE_DOWN_THRESHOLD && canArchiveOptimistic) {
        // Swiped down - archive (only if user is allowed)
        completeSwipe('down', cardIndex, gesture);
      } else {
        // Return to center
        resetPosition();
      }
    },
    onPanResponderTerminate: () => {
      // If the gesture is terminated for any reason, reset everything
      if (!isSwipeAnimating) {
        resetPosition();
      }
    },
  }), [isSwipeAnimating, position, activeTasks, cardIndex, cardOpacity, resetPosition, handleSwipedLeft, handleSwipedRight, handleSwipedUp, handleSwipedDown, canCompleteTask, canNudgeTask, canArchiveTask, completeSwipe, loadingRoles, currentUser]);

  // Check for postponed tasks in the system
  useEffect(() => {
    const checkPostponedTasks = async () => {
      try {
        // Query for any postponed tasks
        const result = await powersync.execute(
          "SELECT COUNT(*) as count FROM tasks WHERE is_postponed = 1"
        );
        
        // Check if there are postponed tasks
        const postponedCount = result.rows?._array?.[0]?.count || 0;
        setHasPostponedTasks(postponedCount > 0);
      } catch (error) {
        console.error("Error checking for postponed tasks:", error);
      } finally {
        setCheckingPostponedTasks(false);
      }
    };
    
    checkPostponedTasks();
  }, [cardIndex]); // Re-check when cardIndex changes as this indicates task state may have changed

  // Check if all cards have been swiped
  useEffect(() => {
    // No longer need to call onFinish when all cards are swiped
    // This prevents the "All Done!" popup from appearing
  }, [cardIndex, activeTasks.length, onFinish]);

  // Animate card transitions - we don't need this useEffect anymore since we trigger the animation directly
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Prepare combined tasks for display (active tasks first, then postponed)
  const allTasks = useMemo(() => {
    return [...activeTasks, ...postponedTasks];
  }, [activeTasks, postponedTasks]);

  // Toggle between stack and list modes
  const toggleViewMode = useCallback(() => {
    // Toggle the mode
    setIsListMode((prev) => !prev);

    // Animate the transition
    Animated.timing(listAnimationValue, {
      toValue: isListMode ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isListMode, listAnimationValue]);

  // If there are no tasks, show an empty state
  if (activeTasks.length === 0 && postponedTasks.length === 0 && cardIndex === 0) {
    // Show loading state while checking
    if (checkingPostponedTasks) {
      return (
        <View style={styles.container}>
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="small" color="#3800FF" />
          </View>
        </View>
      );
    }
    
    // Only show "All done" if there are no postponed tasks
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Your task list is empty</Text>
        </View>
      </View>
    );
  }

  // Render stack cards (show top 3 cards)
  const renderStackCards = () => {
    const visibleCards = activeTasks.slice(cardIndex, cardIndex + 3);
    return (
      <View style={styles.cardsContainer}>
        {visibleCards.map((task, idx) => {
          let cardYPosition = -18 * idx;
          if (idx === 0 && task.id === "add") cardYPosition = -28;
          const isTopCard = idx === 0;
          const isSecondCard = idx === 1;
          const isThirdCard = idx === 2;
          const cardScale = 1 - (idx * 0.03);
          const shouldApplyPanResponder = isTopCard && task.id !== "add" && !isSwipeAnimating;
          
          // Get prefetched participants for this task
          const taskParticipants = task.id !== 'add' ? participantsMap[task.id] || [] : [];

          // Animation styles for each card position
          let animatedStyle = {};
          if (isPromotingCards) {
            if (isSecondCard) {
              animatedStyle = {
                transform: [
                  { scale: secondCardScale },
                  { translateY: secondCardTranslateY },
                ],
                zIndex: 2,
              };
            } else if (isThirdCard) {
              animatedStyle = {
                transform: [
                  { scale: thirdCardScale },
                  { translateY: thirdCardTranslateY },
                ],
                zIndex: 1,
              };
            }
          }

          const cardStyle = {
            ...styles.cardStyle,
            zIndex: 3 - idx,
            opacity: 1 - (idx * 0.05),
            transform: [
              { scale: cardScale },
              { translateY: cardYPosition },
            ],
            ...animatedStyle,
          };

          if (isTopCard) {
            return (
              <Animated.View
                key={`${task.id}`}
                style={[
                  styles.cardStyle,
                  cardStyle,
                  {
                    transform: [
                      { translateX: position.x },
                      { translateY: position.y },
                      { scale: cardScale },
                      { rotate: rotateAnimValue },
                    ],
                    opacity: cardOpacity,
                  },
                ]}
                {...(shouldApplyPanResponder ? panResponder.panHandlers : {})}
              >
                <View style={styles.cardWrapper}>
                  {task.id === "add" ? (
                    <AddTaskCard {...addTaskCardProps} />
                  ) : (
                    <TaskCard 
                      task={task} 
                      style={styles.centerCard} 
                      prefetchedParticipants={taskParticipants}
                    />
                  )}
                </View>
                {/* Overlays only for swipable cards */}
                {task.id !== "add" && (
                  <>
                    {/* Left Swipe (Postpone) Overlay */}
                    <Animated.View
                      style={[
                        styles.overlayContainer,
                        styles.leftOverlay,
                        { opacity: leftSwipeOverlayOpacity },
                      ]}
                    >
                      <View style={styles.overlayContent}>
                        <Image source={require('../../assets/icons/YellowPostpone.png')} style={[styles.overlayIcon, { transform: [{ rotate: '12deg' }] }]} />
                        <Text style={styles.latenText}>Later</Text>
                      </View>
                    </Animated.View>
                    {/* Right Swipe (Complete) Overlay */}
                    <Animated.View
                      style={[
                        styles.overlayContainer,
                        styles.rightOverlay,
                        { opacity: rightSwipeOverlayOpacity },
                      ]}
                    >
                      <View style={styles.overlayContent}>
                        <Image source={require('../../assets/icons/GreenCheck.png')} style={styles.overlayIcon} />
                        <Text style={styles.doneText}>Done</Text>
                      </View>
                    </Animated.View>
                    {/* Upward Swipe (Nudge) Overlay */}
                    <Animated.View
                      style={[
                        styles.overlayContainer,
                        styles.upOverlay,
                        { opacity: upSwipeOverlayOpacity },
                      ]}
                    >
                      <View style={styles.overlayContent}>
                        <Image source={require('../../assets/icons/NudgeIcon.png')} style={styles.overlayIcon} />
                        <Text style={styles.nudgeText}>Nudge</Text>
                      </View>
                    </Animated.View>
                    
                    {/* Downward Swipe (Archive) Overlay */}
                    <Animated.View
                      style={[
                        styles.overlayContainer,
                        styles.downOverlay,
                        { opacity: downSwipeOverlayOpacity },
                      ]}
                    >
                      <View style={styles.overlayContent}>
                        <Image source={require('../../assets/icons/ArchiveIcon.png')} style={styles.overlayIcon} />
                        <Text style={styles.archiveText}>Archive</Text>
                      </View>
                    </Animated.View>
                  </>
                )}
              </Animated.View>
            );
          }

          // For second and third cards, apply animated promotion styles
          if ((isSecondCard || isThirdCard) && isPromotingCards) {
            return (
              <Animated.View
                key={`${task.id}`}
                style={[styles.cardStyle, cardStyle]}
              >
                {task.id === "add" ? (
                  <AddTaskCard {...addTaskCardProps} />
                ) : (
                  <TaskCard 
                    task={task} 
                    style={styles.centerCard}
                    prefetchedParticipants={taskParticipants}
                  />
                )}
              </Animated.View>
            );
          }

          // For all other cards
          return (
            <Animated.View
              key={`${task.id}`}
              style={[styles.cardStyle, cardStyle]}
            >
              {task.id === "add" ? (
                <AddTaskCard {...addTaskCardProps} />
              ) : (
                <TaskCard 
                  task={task} 
                  style={styles.centerCard}
                  prefetchedParticipants={taskParticipants} 
                />
              )}
            </Animated.View>
          );
        })}
      </View>
    );
  };

  // Add opacity interpolation
  const opacity = position.y.interpolate({
    inputRange: [-height, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Display a loading indicator only during initial load */}
      {isInitialLoad && loadingParticipants && activeTasks.length > 0 && cardIndex === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3800FF" />
          <Text style={styles.loadingText}>Loading your tasks...</Text>
        </View>
      ) : !isListMode ? (
        <View style={styles.deckTouchable}>
          {renderStackCards()}
        </View>
      ) : (
        <View style={styles.listModeContainer}>
          <TouchableOpacity
            style={styles.returnButton}
            activeOpacity={0.7}
            onPress={toggleViewMode}
          >
            <Text style={styles.returnButtonText}>Return to Deck View</Text>
          </TouchableOpacity>

          <Animated.ScrollView
            style={[
              styles.scrollView,
              {
                opacity: listAnimationValue,
                transform: [
                  {
                    translateY: listAnimationValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={true}
          >
            {allTasks.map((task: Task, index: number) => {
              // Get prefetched participants for this task
              const taskParticipants = task.id !== 'add' ? participantsMap[task.id] || [] : [];
              
              return (
                <Animated.View
                  key={task.id}
                  style={[
                    styles.listItemContainer,
                    {
                      transform: [
                        {
                          scale: listAnimationValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <TaskCard 
                    task={task} 
                    prefetchedParticipants={taskParticipants}
                  />
                </Animated.View>
              );
            })}
          </Animated.ScrollView>
        </View>
      )}

      {/* Progress indicator that can be tapped to switch views */}
      {!isListMode && (
        <TouchableOpacity
          style={styles.progressContainer}
          onPress={toggleViewMode}
          activeOpacity={0.7}
        >
          {/* <View style={styles.progressInner}>
            <Text style={styles.progressText}>
              {cardIndex + 1} of {activeTasks.length} (tap to view all)
            </Text>
          </View> */}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  cardsContainer: {
    flex: 1,
    position: "relative",
    width: "100%",
    // Add more spacing at the top to give room for cards to stack upward
    paddingTop: 40,
  },
  cardStyle: {
    position: "absolute",
    width: "100%",
    height: "auto",
    alignSelf: "center",
  },
  centerCard: {
    alignSelf: "center",
    marginLeft: "auto",
    marginRight: "auto",
    // Add a shadow to make the frontmost card stand out
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // Overlay styles
  overlayContainer: {
    position: "absolute",

    width: CARD_WIDTH,
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  leftOverlay: {
    backgroundColor: "#FFF6CC",
  },
  rightOverlay: {
    backgroundColor: "#9CF697",
  },
  overlayContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlayIcon: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  doneText: {
    color: "#17B20F",
    textAlign: "center",
    fontFamily: "Sharpie",
    fontSize: 32,
    fontWeight: "500",
    lineHeight: 32,
    letterSpacing: 0.15,
  },
  latenText: {
    color: "#F9D923",
    textAlign: "center",
    fontFamily: "Sharpie",
    fontSize: 32,
    fontWeight: "500",
    lineHeight: 32,
    letterSpacing: 0.15,
  },
  progressContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 40 : 20,
    alignSelf: "center",
    zIndex: 999,
  },
  progressInner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  progressText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  deckTouchable: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    // Add padding at the top to make room for stacked cards
    paddingTop: 25,
  },
  listModeContainer: {
    flex: 1,
    width: "100%",
    paddingTop: 10,
  },
  returnButton: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 15,
    alignSelf: "center",
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  scrollView: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 20,
  },
  scrollViewContent: {
    paddingVertical: 20,
    alignItems: "center",
  },
  listItemContainer: {
    marginBottom: 20,
    width: "100%",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: "100%",
    alignSelf: "center",
    borderRadius: 20,
    overflow: "hidden",
  },
  upOverlay: {
    backgroundColor: "#1249D333",
  },
  downOverlay: {
    backgroundColor: "#3800FF33",
  },
  nudgeText: {
    color: "#1249D3",
    textAlign: "center",
    fontFamily: "Sharpie",
    fontSize: 36,
    fontWeight: "600",
    lineHeight: 36,
    letterSpacing: 0.15,
  },
  archiveText: {
    color: "#3800FF",
    textAlign: "center",
    fontFamily: "Sharpie",
    fontSize: 36,
    fontWeight: "600",
    lineHeight: 36,
    letterSpacing: 0.15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 10,
  },
});

export default TaskDeck;
