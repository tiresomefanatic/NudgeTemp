import React from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import LaterStackTaskCard from "@/components/tasks/LaterStackTaskCard";

// Mock data for the tasks
const mockTasks = [
  {
    id: '1',
    title: 'Rent a movie',
    userName: 'Alice',
    date: 'Tuesday',
    participants: ['A', 'S'],
  },
  {
    id: '2',
    title: 'Buy tickets for IPL',
    userName: 'Sam',
    date: 'Wednesday',
    participants: ['A', 'S'],
  },
  {
    id: '3',
    title: 'Pay gym fee for both',
    userName: 'Alice',
    date: '2nd May',
    participants: ['S'],
  },
  {
    id: '4',
    title: 'Pay the Electricity bill',
    userName: 'Sam',
    date: '16th Apr',
    participants: ['A'],
  },
  {
    id: '5',
    title: 'Get groceries',
    userName: 'Alice',
    date: '14th Apr',
    participants: ['A', 'S'],
  },
];

export default function LaterStackScreen() {
  // Function to navigate back to the tasks screen
  const navigateBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header inside SafeAreaView */}
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
            <TouchableOpacity>
              <Image source={require("@/assets/icons/notification-bell.png")} style={{ width: 32, height: 32 }} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        </View>
      </RNSafeAreaView>

      {/* Content container with task cards */}
      <View style={styles.contentContainer}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
        >
          {mockTasks.map(task => (
            <LaterStackTaskCard
              key={task.id}
              title={task.title}
              userName={task.userName}
              date={task.date}
              participants={task.participants}
            />
          ))}
        </ScrollView>
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
    justifyContent: 'center',
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
    fontStyle: 'italic',
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
}); 