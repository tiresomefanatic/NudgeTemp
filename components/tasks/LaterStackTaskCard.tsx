import React from "react";
import { StyleSheet, Text, View, ViewStyle, Image, TouchableOpacity } from "react-native";
import { router } from "expo-router";

interface LaterStackTaskCardProps {
  title: string;
  userName: string;
  date: string;
  participants: string[];
  style?: ViewStyle;
  taskId?: string;
  ownerInitial: string;
}

const LaterStackTaskCard: React.FC<LaterStackTaskCardProps> = ({ 
  title, 
  userName, 
  date, 
  participants,
  style,
  taskId = "task-id",
  ownerInitial
}) => {
  const navigateToNotes = () => {
    router.push({
      pathname: "/notes",
      params: { taskId, taskTitle: title }
    });
  };

  return (
    <View style={[styles.card, style]}>
      {/* Left Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{ownerInitial}</Text>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{title}</Text>
        
        {/* Info row */}
        <View style={styles.infoRow}>
          {/* User info */}
          <View style={styles.userInfo}>
            <Image 
              source={require('@/assets/icons/User.png')} 
              style={styles.icon} 
            />
            <Text style={styles.infoText}>By {userName}</Text>
          </View>
          
          {/* Dot separator */}
          <Text style={styles.dot}>•</Text>
          
          {/* Date */}
          <View style={styles.dateInfo}>
            <Image 
              source={require('@/assets/icons/calendar.png')} 
              style={styles.icon} 
            />
            <Text style={styles.infoText}>{date}</Text>
          </View>
          
          {/* Only show dot separator and participants if there are participants */}
          {participants.length > 0 && (
            <>
              {/* Dot separator */}
              <Text style={styles.dot}>•</Text>
              
              {/* Participants */}
              <View style={styles.participantsContainer}>
                {participants.map((initial, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.participantBadge,
                      index > 0 ? { marginLeft: -10 } : null
                    ]}
                  >
                    <Text style={styles.participantText}>{initial}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
      
      {/* Chat icon */}
      <TouchableOpacity style={styles.chatButton} onPress={navigateToNotes}>
        <Image 
          source={require('@/assets/icons/Chat.png')} 
          style={styles.chatIcon} 
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 361,
    height: 72,
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C8CAD0',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  avatar: {
    display: 'flex',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 16,
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#717683',
    fontFamily: 'Urbanist',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  infoText: {
    color: '#9CA0AA',
    fontFamily: 'Urbanist',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14.4,
  },
  dot: {
    color: '#9CA0AA',
    marginHorizontal: 8,
    fontSize: 12,
  },
  participantsContainer: {
    flexDirection: 'row',
  },
  participantBadge: {
    display: 'flex',
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    backgroundColor: '#0F3CAE',
  },
  participantText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  chatButton: {
    marginLeft: 12,
  },
  chatIcon: {
    width: 32,
    height: 32,
  },
});

export default LaterStackTaskCard; 