import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useNavigation } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from "@/lib/auth/AuthContext";
import { Redirect } from "expo-router";

const { width } = Dimensions.get("window");

const SWIPE_THRESHOLD = width * 0.3;

interface Notification {
  id: string;
  user: string;
  action: string;
  content: string;
  time: string;
  type: string;
}

// Mock data for notifications
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    user: 'Alice',
    action: 'gave you a frustrated nudge about',
    content: '"Buy groceries on your way back"',
    time: '5 min ago',
    type: 'frustrated'
  },
  {
    id: '2',
    user: 'Allen',
    action: 'added you to',
    content: '"Recommend a good movie"',
    time: '19 min ago',
    type: 'added'
  },
  {
    id: '3',
    user: 'Alice',
    action: 'gave you a friendly nudge about',
    content: '"Buy groceries on your way back"',
    time: '6 hrs ago',
    type: 'friendly'
  },
];

const MOCK_OLDER_NOTIFICATIONS: Notification[] = [
  {
    id: '4',
    user: 'Alice',
    action: 'gave you a frustrated nudge about',
    content: '"Buy groceries on your way back"',
    time: '5 min ago',
    type: 'frustrated'
  },
  {
    id: '5',
    user: 'Sam',
    action: 'gave you a friendly nudge about',
    content: '"Finish the project proposal"',
    time: '1 day ago',
    type: 'friendly'
  },
  {
    id: '6',
    user: 'John',
    action: 'gave you a reminder about',
    content: '"Schedule team meeting"',
    time: '2 days ago',
    type: 'reminder'
  }
];

interface NotificationCardProps {
  notification: Notification;
  onDismiss: (id: string) => void;
  onDone: (id: string) => void;
}

const NotificationCard = ({ notification, onDismiss, onDone }: NotificationCardProps) => {
  // Animation values for swipe
  const position = new Animated.ValueXY();
  const opacity = new Animated.Value(1);
  
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 5;
    },
    onPanResponderMove: (evt, gestureState) => {
      position.setValue({ x: gestureState.dx, y: 0 });
    },
    onPanResponderRelease: (evt, gestureState) => {
      if (gestureState.dx < -SWIPE_THRESHOLD) {
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
        ]).start(() => {
          onDismiss(notification.id);
        });
      } else if (gestureState.dx > SWIPE_THRESHOLD) {
        Animated.parallel([
          Animated.timing(position, {
            toValue: { x: width, y: 0 },
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start(() => {
          onDone(notification.id);
        });
      } else {
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }
    }
  });

  return (
    <Animated.View
      style={[
        styles.notificationContainer,
        {
          transform: [{ translateX: position.x }],
          opacity: opacity,
        }
      ]}
      {...panResponder.panHandlers}
    >
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTextTitle}>
          <Text>{notification.user} </Text>
          <Text>{notification.action} </Text>
          <Text>{notification.content}</Text>
        </Text>
        <View style={styles.notificationFooterOnlyTime}>
          <Text style={styles.timeText}>{notification.time}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

export default function NotificationsScreen() {
  const { session } = useAuth();
  const navigation = useNavigation();
  
  // Redirect to auth if not logged in
  if (!session) {
    return <Redirect href="/(auth)" />;
  }
  
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [olderNotifications, setOlderNotifications] = useState<Notification[]>(MOCK_OLDER_NOTIFICATIONS);
  const [isDismissModalVisible, setIsDismissModalVisible] = useState(false);
  const [dismissReason, setDismissReason] = useState('');
  const [currentDismissId, setCurrentDismissId] = useState<string | null>(null);
  
  const navigateBack = () => {
    Haptics.selectionAsync();
    router.back();
  };
  
  const handleDismiss = (id: string) => {
    setCurrentDismissId(id);
    setDismissReason('');
    setIsDismissModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const confirmDismiss = () => {
    if (currentDismissId) {
      setNotifications(notifications.filter(n => n.id !== currentDismissId));
      setOlderNotifications(olderNotifications.filter(n => n.id !== currentDismissId));
      setIsDismissModalVisible(false);
      setCurrentDismissId(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };
  
  const cancelDismiss = () => {
    setIsDismissModalVisible(false);
    setCurrentDismissId(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handleDone = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNotifications(notifications.filter(n => n.id !== id));
    setOlderNotifications(olderNotifications.filter(n => n.id !== id));
  };
  
  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNotifications([]);
    setOlderNotifications([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Dismiss Popup Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDismissModalVisible}
        onRequestClose={cancelDismiss}
      >
        <TouchableWithoutFeedback onPress={cancelDismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
              >
                <View style={styles.dismissPopup}>
                  <View style={styles.dismissPopupContent}>
                    <View style={styles.dismissPopupHeader}>
                      <View style={styles.dismissPopupSpacer} />
                      <TouchableOpacity style={styles.closeButton} onPress={cancelDismiss}>
                        <Image
                          source={require("@/assets/icons/Close.png")}
                          style={styles.closeIcon}
                          resizeMode="contain"
                        />
                      </TouchableOpacity>
                    </View>
                    
                    <TextInput
                      style={styles.dismissInput}
                      placeholder="Reason for dismissing this task (optional)"
                      placeholderTextColor="#9CA0AA"
                      value={dismissReason}
                      onChangeText={setDismissReason}
                      multiline
                      maxLength={50}
                    />
                    
                    <Text style={styles.characterCount}>
                      {dismissReason.length}/50
                    </Text>
                    
                    <TouchableOpacity 
                      style={styles.sendButton}
                      onPress={confirmDismiss}
                    >
                      <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
            <Text style={styles.headerTitle}>Notification</Text>
          </View>
          <View style={styles.headerIconsRight} />
        </View>
      </RNSafeAreaView>

      {/* Content container with notifications */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Notifications */}
        <View style={styles.notificationsSection}>
          {notifications.map(notification => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onDismiss={handleDismiss}
              onDone={handleDone}
            />
          ))}
        </View>
        
        {/* Older Notifications Section */}
        {olderNotifications.length > 0 && (
          <View style={styles.olderSection}>
            <View style={styles.olderHeader}>
              <Text style={styles.olderTitle}>OLDER</Text>
              <TouchableOpacity onPress={handleClearAll}>
                <Text style={styles.clearAllTextCustom}>Clear all</Text>
              </TouchableOpacity>
            </View>
            
            {/* Stacked older notifications */}
            <View style={styles.stackedNotifications}>
              {olderNotifications.map((notification, index) => {
                if (index > 2) return null;
                
                const scale = Math.pow(0.95, index); 
                const topOffset = index * 20; 
                
                return (
                  <View
                    key={notification.id}
                    style={[
                      styles.stackedCard,
                      styles.stackedCardCustom,
                      {
                        zIndex: 3 - index,
                        top: topOffset,
                        transform: [{ scale }],
                        left: 'auto',
                        right: 'auto',
                        alignSelf: 'center',
                      }
                    ]}
                  >
                    <NotificationCard
                      notification={notification}
                      onDismiss={handleDismiss}
                      onDone={handleDone}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F4F6',
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
    width: 32, 
  },
  headerTitle: {
    fontFamily: 'Sharpie',
    fontSize: 32,
    color: '#3800FF',
    fontWeight: '500',
    lineHeight: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
  },
  notificationsSection: {
    gap: 12,
  },
  notificationContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#191919',
    backgroundColor: '#FFF',
  },
  notificationContent: {
    width: '100%',
    padding: 12,
  },
  notificationTextTitle: {
    color: '#393B42',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '300',
    lineHeight: 20,
    letterSpacing: 0,
  },
  notificationFooterOnlyTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  timeText: {
    color: '#717683',
    fontFamily: 'Sharpie',
    fontSize: 10,
    fontStyle: 'normal',
    fontWeight: '300',
    lineHeight: 14,
    letterSpacing: 0,
  },
  olderSection: {
    marginTop: 24,
  },
  olderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  olderTitle: {
    color: '#868B97',
    fontFamily: 'Kalam',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.15,
  },
  clearAllTextCustom: {
    color: '#393B42',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '300',
    lineHeight: 20,
    letterSpacing: 0,
  },
  stackedNotifications: {
    position: 'relative',
    height: 240,
    marginBottom: 20,
  },
  stackedCard: {
    position: 'absolute',
    width: '100%',
  },
  stackedCardCustom: {

  },
  // Dismiss Popup Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.70)',
    backdropFilter: 'blur(3px)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  dismissPopup: {
    width: '100%',
    backgroundColor: '#F4F4F6',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E6E6E6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -8,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 10,
  },
  dismissPopupContent: {
    padding: 16,
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  dismissPopupHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  dismissPopupSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    width: 20,
    height: 20,
  },
  dismissInput: {
    padding: 12,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DEDFE3',
    backgroundColor: '#FFF',
    minHeight: 120,
    maxHeight: 120,
    color: '#000',
    fontFamily: 'Pally',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: '#868B97',
    fontFamily: 'Pally',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 22,
    alignSelf: 'flex-end',
  },
  sendButton: {
    padding: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 12,
    backgroundColor: '#1249D3',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  sendButtonText: {
    color: '#FFF',
    fontFamily: 'Pally',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
  },
}); 