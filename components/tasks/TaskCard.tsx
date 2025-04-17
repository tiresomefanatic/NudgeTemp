import React from 'react';
import { StyleSheet, Text, View, Dimensions, ViewStyle } from 'react-native';
import { Task } from '../../types/task';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.75; // Make cards slightly narrower

interface TaskCardProps {
  task: Task;
  style?: ViewStyle;
}

const getPriorityColor = (priority?: 'low' | 'medium' | 'high') => {
  switch (priority) {
    case 'high':
      return '#c3e9e7'; // Light teal for all cards to match screenshot
    case 'medium':
      return '#c3e9e7'; // Light teal for all cards to match screenshot
    case 'low':
      return '#c3e9e7'; // Light teal for all cards to match screenshot
    default:
      return '#c3e9e7'; // Light teal for all cards to match screenshot
  }
};

const TaskCard: React.FC<TaskCardProps> = ({ task, style }) => {
  const backgroundColor = getPriorityColor(task.priority);

  return (
    <View style={[styles.card, { backgroundColor }, style, styles.centeredCard]}>
      <View style={styles.priorityIndicator}>
        <Text style={styles.priorityText}>{task.priority?.toUpperCase() || 'TASK'}</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{task.title}</Text>
        {task.description && (
          <Text style={styles.description}>{task.description}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  centeredCard: {
    alignSelf: 'center', // Ensure card is centered
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.2,  // Slightly shorter height ratio
    borderRadius: 24,
    backgroundColor: '#c3e9e7', // Light teal to match screenshot
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  priorityIndicator: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    opacity: 0, // Hide priority indicator to match the clean look in screenshot
  },
  priorityText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 12,
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 28,
    marginBottom: 16,
  },
  description: {
    color: '#555',
    fontSize: 18,
    opacity: 0.9,
  },
});

export default TaskCard;
