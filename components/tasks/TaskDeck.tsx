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
} from "react-native";
import Swiper from "react-native-deck-swiper";
import { Task } from "../../types/task";
import TaskCard from "./TaskCard";

const { width, height } = Dimensions.get("window");

interface TaskDeckProps {
  tasks: Task[];
  onComplete: (task: Task) => void;
  onPostpone: (task: Task) => void;
  onFinish?: () => void;
}

const TaskDeck: React.FC<TaskDeckProps> = ({
  tasks: initialTasks,
  onComplete,
  onPostpone,
  onFinish,
}) => {
  const swiperRef = useRef<Swiper<Task>>(null);

  // Active tasks in the current deck
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  // Tasks that have been postponed
  const [postponedTasks, setPostponedTasks] = useState<Task[]>([]);
  // Track current card index
  const [cardIndex, setCardIndex] = useState(0);
  // Track list vs deck view mode
  const [isListMode, setIsListMode] = useState(false);
  // Animation value for list transitions
  const listAnimationValue = useRef(new Animated.Value(0)).current;

  // Initialize the deck when we receive initialTasks
  useEffect(() => {
    setActiveTasks([...initialTasks]);
    setPostponedTasks([]);
    setCardIndex(0);
  }, [initialTasks]);

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

  // Function to handle when a card is swiped left (postponed)
  const handleSwipedLeft = (index: number) => {
    // Get the task being postponed
    const taskToPostpone = activeTasks[index];

    // Call the parent's callback
    onPostpone(taskToPostpone);

    // Add task to postponed list (to be shown at the end of the active list)
    setPostponedTasks((prev) => [...prev, taskToPostpone]);
  };

  // Function to handle when a card is swiped right (completed)
  const handleSwipedRight = (index: number) => {
    // Task complete
    onComplete(activeTasks[index]);
  };

  // Handle any swipe (left or right)
  const handleSwiped = (index: number) => {
    // Just update the card index
    setCardIndex(index + 1);
  };

  // Handle when all cards have been swiped
  const handleAllSwiped = () => {
    // If we have postponed tasks, move them to active
    if (postponedTasks.length > 0) {
      setActiveTasks(postponedTasks);
      setPostponedTasks([]);
      setCardIndex(0);

      // Give the swiper a moment to reset
      setTimeout(() => {
        if (swiperRef.current) {
          swiperRef.current.jumpToCardIndex(0);
        }
      }, 100);
    } else if (onFinish) {
      onFinish();
    }
  };

  // If there are no tasks, show an empty state
  if (!activeTasks.length && !postponedTasks.length) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>All done for today! 🎉</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isListMode ? (
        <View style={styles.deckTouchable}>
          <Swiper
            ref={swiperRef}
            cards={activeTasks}
            renderCard={(task) =>
              task ? <TaskCard task={task} style={styles.centerCard} /> : null
            }
            onSwipedRight={handleSwipedRight}
            onSwipedLeft={handleSwipedLeft}
            onSwipedAll={handleAllSwiped}
            cardIndex={cardIndex}
            backgroundColor={"transparent"}
            stackSize={3}
            stackSeparation={-10} // Negative value to make cards overlap at the top
            disableTopSwipe={true}
            disableBottomSwipe={true}
            stackScale={0.98}
            infinite={false}
            animateOverlayLabelsOpacity
            animateCardOpacity
            swipeBackCard
            overlayOpacityHorizontalThreshold={20}
            verticalSwipe={false}
            containerStyle={styles.swiperContainer}
            cardStyle={styles.cardStyle}
            cardHorizontalMargin={0}
            onSwiped={handleSwiped}
            secondCardZoom={1}
            zoomFriction={7}
            swipeAnimationDuration={350}
            outputRotationRange={["-6deg", "0deg", "6deg"]}
            overlayLabels={{
              left: {
                title: "POSTPONE",
                style: {
                  label: {
                    backgroundColor: "rgba(249, 217, 35, 0.9)",
                    borderColor: "#F9D923",
                    color: "black",
                    borderWidth: 0,
                    fontSize: 28,
                    fontWeight: "bold",
                    padding: 16,
                    borderRadius: 8,
                    textShadowColor: "rgba(0, 0, 0, 0.2)",
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 1,
                  },
                  wrapper: {
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    marginTop: 30,
                    marginLeft: 20,
                  },
                },
              },
              right: {
                title: "COMPLETE",
                style: {
                  label: {
                    backgroundColor: "rgba(57, 199, 165, 0.9)",
                    borderColor: "#39C7A5",
                    color: "white",
                    borderWidth: 0,
                    fontSize: 28,
                    fontWeight: "bold",
                    padding: 16,
                    borderRadius: 8,
                    textShadowColor: "rgba(0, 0, 0, 0.2)",
                    textShadowOffset: { width: 1, height: 1 },
                    textShadowRadius: 1,
                  },
                  wrapper: {
                    flexDirection: "column",
                    alignItems: "flex-end",
                    justifyContent: "flex-start",
                    marginTop: 30,
                    marginRight: 20,
                  },
                },
              },
            }}
          />
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
  swiperContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  cardStyle: {
    alignSelf: "center",
    width: "100%",
    left: 0,
    right: 0,
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
});

export default TaskDeck;
