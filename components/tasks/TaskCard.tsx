import React, { useEffect, useState, memo } from "react";
import { StyleSheet, Text, View, Dimensions, ViewStyle, ScrollView, ActivityIndicator } from "react-native";
import { Task, TaskParticipant } from "../../types/task";
import { useUser, formatUserName, getUserInitial, User, useCurrentUser } from "@/lib/powersync/userService";
import { getTaskParticipants } from "@/lib/powersync/taskService";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85; // Adjusted to match screenshot
const CARD_HEIGHT = height * 0.8; // Increased height for more screen usage

// Static star positions and sizes
const STATIC_STARS = Array(20).fill(null).map((_, i) => ({
  size: 2 + (i % 3),
  top: 10 + (i * 6),
  left: 20 + (i * 18) % CARD_WIDTH,
}));

// Static tree heights and positions
const STATIC_TREES = Array(15).fill(null).map((_, i) => ({
  height: 20 + (i % 5) * 4,
  left: i * (CARD_WIDTH / 15) + 5,
}));

interface TaskCardProps {
  task: Task;
  style?: ViewStyle;
  prefetchedParticipants?: TaskParticipant[];
}

const TaskCard: React.FC<TaskCardProps> = ({ task, style, prefetchedParticipants }) => {
  const { user: creator, loading: creatorLoading } = useUser(task.creatorId || null);
  const { user: currentUser } = useCurrentUser();
  const [participants, setParticipants] = useState<TaskParticipant[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(!prefetchedParticipants);

  // Use prefetched participants data if available, otherwise fetch it
  useEffect(() => {
    if (prefetchedParticipants) {
      console.log(`Using prefetched data for task ${task.id} - ${prefetchedParticipants.length} participants`);
      setParticipants(prefetchedParticipants);
      setLoadingParticipants(false);
      return;
    }
    
    const fetchParticipants = async () => {
      if (task.id === 'add') {
        setLoadingParticipants(false);
        return;
      }
      
      console.log(`Fetching participants data for task ${task.id}`);
      try {
        const taskParticipants = await getTaskParticipants(task.id);
        setParticipants(taskParticipants);
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, [task.id, prefetchedParticipants]);
  
  // Generate static stars for cosmic illustration
  const renderStars = () => {
    return STATIC_STARS.map((star, i) => (
      <View
        key={i}
        style={{
          position: "absolute",
          width: star.size,
          height: star.size,
          backgroundColor: "white",
          borderRadius: star.size / 2,
          top: star.top,
          left: star.left,
        }}
      />
    ));
  };

  // Generate static trees for forest illustration
  const renderTrees = () => {
    return STATIC_TREES.map((tree, i) => (
      <View
        key={i}
        style={{
          position: "absolute",
          bottom: 0,
          left: tree.left,
          width: 0,
          height: 0,
          borderLeftWidth: 8,
          borderRightWidth: 8,
          borderBottomWidth: tree.height,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: "#4338ca",
          opacity: 0.6,
        }}
      />
    ));
  };

  // Helper function to get initial for avatar
  const getParticipantInitial = (participant: TaskParticipant | undefined) => {
    if (!participant || !participant.user) return '?';
    
    if (participant.user.first_name) {
      return participant.user.first_name.charAt(0).toUpperCase();
    }
    return participant.user.email.charAt(0).toUpperCase();
  };

  // Helper function to get participant name
  const getParticipantName = (participant: TaskParticipant | undefined) => {
    if (!participant || !participant.user) return 'Unknown';
    
    if (participant.user.first_name && participant.user.last_name) {
      return `${participant.user.first_name} ${participant.user.last_name}`;
    }
    
    if (participant.user.first_name) {
      return participant.user.first_name;
    }
    
    return participant.user.email.split('@')[0];
  };

  // Render collaborator avatars
  const renderCollaboratorAvatars = () => {
    if (loadingParticipants) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#3b82f6" />
        </View>
      );
    }

    if (participants.length === 0) {
      return (
        <View style={styles.avatarStack}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {getUserInitial(creator)}
            </Text>
          </View>
        </View>
      );
    }

    // Show at most 2 avatars stacked
    return (
      <View style={styles.avatarStack}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getUserInitial(creator)}</Text>
        </View>
        {participants.length > 0 && (
          <View style={styles.greenAvatarStacked}>
            <Text style={styles.greenAvatarText}>
              {getParticipantInitial(participants[0])}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Format collaborator names text
  const getCollaboratorText = () => {
    if (loadingParticipants) {
      return "Loading collaborators...";
    }
    
    // Early return if no creator
    if (!creator) {
      return "Unknown";
    }
    
    // Format the creator name properly
    const creatorName = formatUserName(creator);
    const currentUserId = currentUser?.id;
    const isCurrentUserCreator = currentUserId === creator.id;
    
    // No participants case - just show creator
    if (participants.length === 0) {
      return creatorName;
    }
    
    // Find participants excluding the creator (who might also be in participants list)
    const otherParticipants = participants.filter(p => 
      p.user_id !== creator.id
    );
    
    // If no other participants, only show creator
    if (otherParticipants.length === 0) {
      return creatorName;
    }
    
    // Get formatted names of other participants
    const otherParticipantNames = otherParticipants
      .map(p => {
        // Check if this participant is the current user
        const isCurrentUser = p.user_id === currentUserId;
        // Get a proper name, but ensure we're not duplicating "you" labels
        const name = getParticipantName(p);
        return isCurrentUser ? `you` : name;
      })
      .filter(Boolean) // Remove any null/undefined
      .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
    
    // Join all names with commas, ensuring proper "you" placement
    if (isCurrentUserCreator) {
      // Current user is creator, so name already includes "you"
      return `${creatorName} (you)${otherParticipantNames.length > 0 ? `, ${otherParticipantNames.join(', ')}` : ''}`;
    } else {
      // Current user is not creator
      return `${creatorName}${otherParticipantNames.length > 0 ? `, ${otherParticipantNames.join(', ')}` : ''}`;
    }
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.fixedHeader}>
        {/* Cosmic illustration */}
        <View style={styles.illustration}>
          {renderStars()}
          {/* Static planet-like circles */}
          <View style={styles.planet1} />
          <View style={styles.planet2} />
          <View style={styles.planet3} />
          {/* Static scribbles to mimic the hand-drawn look */}
          <View style={styles.scribble1} />
          <View style={styles.scribble2} />
          <View style={styles.scribble3} />
        </View>

        {/* Forest illustration */}
        <View style={styles.forestIllustration}>
          {renderTrees()}
          {/* Static lines to mimic the text-like scribbles */}
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
          <Text style={styles.updatedTaskTitle}>
            {task.title || "Plan a vacation to Jakarta and Bali"}
          </Text>
        </View>

        {/* Owner pill - show actual creator */}
        <View style={styles.ownerPillRow}>
          <View style={styles.ownerPill}>
            <Text style={styles.ownerPillText}>
              {creatorLoading ? 'Loading...' : formatUserName(creator)}
            </Text>
          </View>
        </View>

        {/* 24px gap */}
        <View style={{ height: 24 }} />

        {/* Details section */}
        <Text style={styles.detailsSectionHeader}>DETAILS</Text>
        <View style={{ height: 4 }} />
        <Text style={styles.updatedDetailsText}>
          {task.description ||
            "Find hotels for 3 days in Jakarta and 5 days in Bali. Check out cheap ticket options to fly down"}
        </Text>

        {/* Collaborators section */}
        <Text style={styles.collaboratorsSectionHeader}>COLLABORATORS</Text>
        <View style={styles.collaboratorsRow}>
          {renderCollaboratorAvatars()}
          <Text style={styles.collaboratorNamesText}>
            {getCollaboratorText()}
          </Text>
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
    shadowColor: "#fff",
    shadowOffset: { width: 12, height: -20 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
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
  updatedTaskTitle: {
    color: '#5A52FF',
    fontSize: 24,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.25,
  },
  ownerPillRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
    gap: 10,
  },
  ownerPill: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A0075',
    paddingVertical: 4,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerPillText: {
    color: '#393B42',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 0,
  },
  detailsSectionHeader: {
    color: '#868B97',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.15,
    marginHorizontal: 20,
    marginBottom: 0,
    marginTop: 0,
  },
  updatedDetailsText: {
    color: '#393B42',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '300',
    lineHeight: 20,
    letterSpacing: 0,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  collaboratorsSectionHeader: {
    color: '#868B97',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.15,
    marginHorizontal: 20,
    marginBottom: 8,
    marginTop: 4,
  },
  collaboratorsRow: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    width: 44, // enough to show overlap
    height: 36,
    marginRight: 4,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: 0,
    left: 0,
  },
  avatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  greenAvatarStacked: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 20, // overlap amount
    zIndex: 1,
  },
  greenAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  collaboratorNamesText: {
    color: '#B2B5BD',
    fontFamily: 'Be Vietnam',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 0,
    marginLeft: 10,
  },
  italicText: {
    fontStyle: "italic",
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
  },
});

// Use React.memo to prevent unnecessary re-renders
export default memo(TaskCard);
