import React from "react";
import { StyleSheet, Text, View, Dimensions, ViewStyle, ScrollView } from "react-native";
import { Task } from "../../types/task";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85; // Adjusted to match screenshot
const CARD_HEIGHT = height * 0.8; // Increased height for more screen usage

interface TaskCardProps {
  task: Task;
  style?: ViewStyle;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, style }) => {
  // Generate stars for cosmic illustration
  const renderStars = () => {
    const stars = [];
    for (let i = 0; i < 20; i++) {
      const size = Math.random() * 3 + 1;
      stars.push(
        <View
          key={i}
          style={{
            position: "absolute",
            width: size,
            height: size,
            backgroundColor: "white",
            borderRadius: size / 2,
            top: Math.random() * 130,
            left: Math.random() * CARD_WIDTH,
          }}
        />
      );
    }
    return stars;
  };

  // Generate trees for forest illustration
  const renderTrees = () => {
    const trees = [];
    for (let i = 0; i < 15; i++) {
      const height = Math.random() * 20 + 15;
      trees.push(
        <View
          key={i}
          style={{
            position: "absolute",
            bottom: 0,
            left: i * (CARD_WIDTH / 15) + Math.random() * 10,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderBottomWidth: height,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: "#4338ca",
            opacity: 0.6,
          }}
        />
      );
    }
    return trees;
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.fixedHeader}>
        {/* Cosmic illustration */}
        <View style={styles.illustration}>
          {renderStars()}
          {/* Some planet-like circles */}
          <View style={styles.planet1} />
          <View style={styles.planet2} />
          <View style={styles.planet3} />
          {/* Some random scribbles to mimic the hand-drawn look */}
          <View style={styles.scribble1} />
          <View style={styles.scribble2} />
          <View style={styles.scribble3} />
        </View>

        {/* Forest illustration */}
        <View style={styles.forestIllustration}>
          {renderTrees()}
          {/* Add some lines to mimic the text-like scribbles */}
          <View style={styles.textScribble1} />
          <View style={styles.textScribble2} />
          <View style={styles.textScribble3} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        alwaysBounceVertical={true}
        directionalLockEnabled={true}
      >
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.taskTitle}>
            {task.title || "Plan a vacation to Jakarta and Bali"}
          </Text>
        </View>

        {/* Avatar with initial */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <Text style={styles.ownerName}>Alice</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Details section */}
        <Text style={styles.sectionHeader}>DETAILS</Text>
        <Text style={styles.detailsText}>
          {task.description ||
            "Find hotels for 3 days in Jakarta and 5 days in Bali. Check out cheap ticket options to fly down"}
        </Text>

        {/* Collaborators section */}
        <Text style={styles.sectionHeader}>COLLABORATORS</Text>
        <View style={styles.collaboratorsRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View style={styles.greenAvatar}>
            <Text style={styles.greenAvatarText}>$</Text>
          </View>
          <Text style={styles.collaboratorText}>
            Alice, <Text style={styles.italicText}>you</Text>
          </Text>
        </View>

        {/* Notes & Nudges section */}
        <Text style={styles.sectionHeader}>NOTES & NUDGES</Text>
        <View style={styles.nudgeContainer}>
          <View style={styles.nudgePill}>
            <Text style={styles.nudgeText}>
              Remind me on Wednesday to do this
            </Text>
            <View style={styles.smallGreenAvatar}>
              <Text style={styles.greenAvatarText}>$</Text>
            </View>
          </View>
        </View>
        
        {/* Add extra padding at bottom */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#3b82f6",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  fixedHeader: {
    width: "100%",
    position: "relative",
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  bottomPadding: {
    height: 40,
  },
  illustration: {
    width: "100%",
    height: 150,
    backgroundColor: "#4f46e5",
    overflow: "hidden",
    position: "relative",
  },
  forestIllustration: {
    width: "100%",
    height: 60,
    backgroundColor: "white",
    overflow: "hidden",
    position: "relative",
  },
  // Planets and scribbles for cosmic illustration
  planet1: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "white",
    top: 40,
    left: 80,
  },
  planet2: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "white",
    top: 70,
    left: 200,
  },
  planet3: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "white",
    top: 30,
    left: 250,
  },
  scribble1: {
    position: "absolute",
    width: 100,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3730a3",
    top: 20,
    left: 50,
    opacity: 0.6,
  },
  scribble2: {
    position: "absolute",
    width: 120,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#3730a3",
    top: 80,
    left: 150,
    opacity: 0.6,
  },
  scribble3: {
    position: "absolute",
    width: 80,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: "#3730a3",
    top: 60,
    left: 20,
    opacity: 0.6,
  },
  // Text-like scribbles for forest
  textScribble1: {
    position: "absolute",
    width: 20,
    height: 1,
    backgroundColor: "#4338ca",
    bottom: 10,
    left: 120,
  },
  textScribble2: {
    position: "absolute",
    width: 30,
    height: 1,
    backgroundColor: "#4338ca",
    bottom: 10,
    left: 180,
  },
  textScribble3: {
    position: "absolute",
    width: 25,
    height: 1,
    backgroundColor: "#4338ca",
    bottom: 10,
    left: 250,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  taskTitle: {
    fontSize: 26,
    color: "#3b82f6",
    fontWeight: "bold",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  ownerName: {
    fontSize: 18,
    color: "#555",
  },
  divider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 1,
    marginHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  detailsText: {
    fontSize: 16,
    color: "#444",
    marginHorizontal: 20,
    marginBottom: 12,
    lineHeight: 22,
  },
  collaboratorsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 12,
  },
  greenAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  greenAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  collaboratorText: {
    fontSize: 16,
    color: "#555",
    marginLeft: 10,
  },
  italicText: {
    fontStyle: "italic",
  },
  nudgeContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  nudgePill: {
    backgroundColor: "#fef08a",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  nudgeText: {
    color: "#92400e",
    fontSize: 14,
    marginRight: 8,
  },
  smallGreenAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TaskCard;
