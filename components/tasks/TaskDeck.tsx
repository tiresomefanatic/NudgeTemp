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

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85;

// Constants for swipe thresholds
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_UP_THRESHOLD = height * 0.15; // Threshold for upward swipe (nudge)
const ROTATION_ANGLE = 8;
const SPRING_CONFIG = { damping: 15, stiffness: 150 };

interface TaskDeckProps {
  tasks: Task[];
  onComplete: (task: Task) => void;
  onPostpone: (task: Task) => void;
  onNudge?: (task: Task) => void; // New callback for nudge action
  onFinish?: () => void;
  addTaskCardProps?: any; // Props for AddTaskCard, if present
}

const TaskDeck: React.FC<TaskDeckProps> = ({
  tasks: initialTasks,
  onComplete,
  onPostpone,
  onNudge,
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
  
  // Animation values for the card
  const position = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
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

  const cardScale = position.y.interpolate({
    inputRange: [-height * 0.7, -SWIPE_UP_THRESHOLD, 0],
    outputRange: [0.85, 0.95, 1],
    extrapolate: 'clamp',
  });

  // Initialize the deck when we receive initialTasks
  useEffect(() => {
    if (initialTasks && initialTasks.length > 0) {
      setActiveTasks([...initialTasks]);
      setPostponedTasks([]);
      setCardIndex(0);
      // Reset animation values
      position.setValue({ x: 0, y: 0 });
    }
  }, [initialTasks]);

  // Function to handle when a card is swiped left (postponed)
  const handleSwipedLeft = useCallback((index: number) => {
    // Get the task being postponed
    const taskToPostpone = activeTasks[index];

    // Call the parent's callback to mark the task as postponed
    onPostpone(taskToPostpone);
    
    // Update the current index to show the next task
    setCardIndex(prevIndex => prevIndex + 1);
    
    // Reset immediately (without animation) for a clean state for the next card
    position.setValue({ x: 0, y: 0 });
    
    // Note: We don't need to manually move the task here as the useTasks hook
    // will now return all tasks with postponed ones at the end of the queue
  }, [activeTasks, onPostpone]);

  // Function to handle when a card is swiped right (completed)
  const handleSwipedRight = useCallback((index: number) => {
    // Task complete
    onComplete(activeTasks[index]);
    
    // Update the current index
    setCardIndex(prevIndex => prevIndex + 1);
    
    // Reset immediately (without animation) for a clean state for the next card
    position.setValue({ x: 0, y: 0 });
  }, [activeTasks, onComplete]);

  // Function to handle when a card is swiped upward (nudged)
  const handleSwipedUp = useCallback((index: number) => {
    if (!onNudge) return;
    
    const taskToNudge = activeTasks[index];
    
    onNudge(taskToNudge);
    
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [activeTasks, onNudge]);

  // Reset position after swipe
  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Create pan responder for swipe gestures
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (evt, gestureState) => {
      // Don't capture gestures for very small movements (likely scrolling)
      return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
    },
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      // Capture horizontal movements for card swiping
      // For upward swipes, make sure we're primarily moving up (negative dy)
      // and the movement is significant
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy * 1.5) ||
             (gestureState.dy < -5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx));
    },
    onPanResponderMove: (_, gesture) => {
      // Apply movement constraints to y-axis for better upward swipe behavior
      // This makes the upward swipe feel more responsive and natural
      let y = gesture.dy;
      
      // Make upward movement (negative dy) more pronounced, but dampen it slightly
      // for more natural feel as card goes higher
      if (gesture.dy < 0) {
        // Apply progressive resistance as the card moves further up
        const dampenFactor = Math.min(1, Math.abs(gesture.dy) / (height * 0.6));
        y = gesture.dy * (1 - (dampenFactor * 0.3));
      } else {
        // Restrict downward movement more
        y = gesture.dy * 0.4;
      }
      
      position.setValue({ x: gesture.dx, y });
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        // Swiped right - complete
        Animated.timing(position, {
          toValue: { x: width * 1.5, y: gesture.dy },
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          handleSwipedRight(cardIndex);
        });
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        // Swiped left - postpone
        Animated.timing(position, {
          toValue: { x: -width * 1.5, y: gesture.dy },
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          handleSwipedLeft(cardIndex);
        });
      } else if (gesture.dy < -SWIPE_UP_THRESHOLD && onNudge) {
        // Swiped up - nudge
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
      } else {
        // Return to center
        resetPosition();
      }
    },
  }), [cardIndex, handleSwipedLeft, handleSwipedRight, handleSwipedUp, onNudge]);

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
    // If no more cards at all, but only call onFinish if it exists
    // AND there are no postponed tasks in the system
    if (cardIndex >= activeTasks.length && onFinish) {
      // We should check for postponed tasks in the app before showing "All Done!"
      // This prevents showing "All Done!" when there are postponed tasks
      
      // Check for any postponed tasks before showing "All Done!"
      const checkPostponedTasks = async () => {
        try {
          // Query for any postponed tasks
          const result = await powersync.execute(
            "SELECT COUNT(*) as count FROM tasks WHERE is_postponed = 1"
          );
          
          // Only call onFinish if there are no postponed tasks
          const postponedCount = result.rows?._array?.[0]?.count || 0;
          if (postponedCount === 0) {
            onFinish();
          }
        } catch (error) {
          console.error("Error checking for postponed tasks:", error);
        }
      };
      
      checkPostponedTasks();
    }
  }, [cardIndex, activeTasks.length, onFinish]);

  // Animate card transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionAnimation = useRef(new Animated.Value(0)).current;
  
  // When cardIndex changes, trigger the transition animation
  useEffect(() => {
    if (cardIndex > 0) {
      setIsTransitioning(true);
      
      // Reset to prepare for animation
      transitionAnimation.setValue(0);
      
      // Animate the transition
      Animated.timing(transitionAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    }
  }, [cardIndex]);

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
          {!hasPostponedTasks ? (
            <Text style={styles.emptyText}>All done for today! 🎉</Text>
          ) : (
            <Text style={styles.emptyText}>No active tasks</Text>
          )}
        </View>
      </View>
    );
  }

  // Render stack cards (show top 3 cards)
  const renderStackCards = () => {
    // Get up to 3 cards to show in the stack
    const visibleCards = activeTasks.slice(cardIndex, cardIndex + 3);
    
    // Render cards from back to front (bottom to top)
    // This way, the first card (current card) will be on top in z-index
    return (
      <View style={styles.cardsContainer}>
        {/* Render cards in order from bottom to top */}
        {visibleCards.map((task, idx) => {
          // If the top card is AddTaskCard, give it a slightly larger offset
          let cardYPosition = -18 * idx;
          if (idx === 0 && task.id === "add") {
            cardYPosition = -28; // lift AddTaskCard a bit more for even spacing
          }
          const isTopCard = idx === 0;
          
          // For the second card, apply a transition animation when it becomes the top card
          const secondCardAnimation = isTransitioning && idx === 0 ? {
            // Start from a position behind and scale slightly smaller
            transform: [
              { 
                scale: transitionAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1],
                })
              },
              {
                translateY: transitionAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-18, cardYPosition],
                })
              }
            ],
            // Fade in to normal opacity
            opacity: transitionAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.95, 1],
            })
          } : {};
          
          // Card styling
          const cardStyle = {
            ...styles.cardStyle,
            // Top card has highest z-index
            zIndex: 3 - idx,
            // Decrease opacity for cards in the back
            opacity: 1 - (idx * 0.05),
            transform: [
              // Decrease scale for cards in the back
              { scale: 1 - (idx * 0.03) },
              // Position cards vertically with the active card at the bottom
              { translateY: cardYPosition }
            ],
            ...(isTopCard && isTransitioning ? secondCardAnimation : {}),
          };

          if (isTopCard) {
            return (
              <Animated.View 
                key={`${task.id}-${cardIndex}`} 
                style={[
                  styles.cardStyle, 
                  cardStyle, 
                  {
                    transform: [
                      { translateX: position.x },
                      { translateY: position.y },
                      { scale: cardScale },
                      { rotate: rotateAnimValue }
                    ]
                  }
                ]}
                {...(task.id !== "add" ? panResponder.panHandlers : {})}
              >
                <View style={styles.cardWrapper}>
                  {task.id === "add" ? (
                    <AddTaskCard {...addTaskCardProps} />
                  ) : (
                    <TaskCard task={task} style={styles.centerCard} />
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
                        { opacity: leftSwipeOverlayOpacity }
                      ]}
                    >
                      <View style={styles.overlayContent}>
                        <Image source={require('../../assets/icons/YellowPostpone.png')} style={[styles.overlayIcon, {transform: [{rotate: '12deg'}]}]} />
                        <Text style={styles.latenText}>Later</Text>
                      </View>
                    </Animated.View>
                    {/* Right Swipe (Complete) Overlay */}
                    <Animated.View 
                      style={[
                        styles.overlayContainer, 
                        styles.rightOverlay, 
                        { opacity: rightSwipeOverlayOpacity }
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
                        { opacity: upSwipeOverlayOpacity }
                      ]}
                    >
                      <View style={styles.overlayContent}>
                        <Image source={require('../../assets/icons/NudgeIcon.png')} style={styles.overlayIcon} />
                        <Text style={styles.nudgeText}>Nudge</Text>
                      </View>
                    </Animated.View>
                  </>
                )}
              </Animated.View>
            );
          }

          return (
            <Animated.View 
              key={`${task.id}-${cardIndex}-${idx}`} 
              style={[
                styles.cardStyle, 
                cardStyle,
                idx === 1 ? { // Special animation for the card that will become the top card next
                  transform: [
                    { scale: 1 - (idx * 0.03) },
                    { translateY: cardYPosition }
                  ]
                } : null
              ]}
            >
              {task.id === "add" ? (
                <AddTaskCard {...addTaskCardProps} />
              ) : (
                <TaskCard task={task} style={styles.centerCard} />
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
      {!isListMode ? (
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
            {allTasks.map((task: Task, index: number) => (
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
                <TaskCard task={task} />
              </Animated.View>
            ))}
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
  nudgeText: {
    color: "#1249D3",
    textAlign: "center",
    fontFamily: "Sharpie",
    fontSize: 36,
    fontWeight: "600",
    lineHeight: 36,
    letterSpacing: 0.15,
  },
});

export default TaskDeck;
