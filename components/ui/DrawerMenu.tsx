import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/lib/auth/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.60; // 25% of screen width

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

const DrawerMenu: React.FC<DrawerMenuProps> = ({ visible, onClose }) => {
  const translateX = new Animated.Value(visible ? 0 : -DRAWER_WIDTH);
  const { signOut } = useAuth();

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -DRAWER_WIDTH,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const navigateTo = (route: string) => {
    Haptics.selectionAsync();
    onClose();
    router.push(route as any);
  };

  const handleOverlayPress = () => {
    onClose();
  };

  const handleLogout = async () => {
    try {
      Haptics.selectionAsync();
      onClose();
      await signOut();
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={handleOverlayPress}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>
      
      <Animated.View 
        style={[
          styles.drawer,
          { transform: [{ translateX }] }
        ]}
      >
        <View style={styles.menuItems}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigateTo('/profile')}
          >
            <Image
              source={require('@/assets/icons/User.png')}
              style={styles.menuIcon}
              resizeMode="contain"
            />
            <Text style={styles.menuItemText}>Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigateTo('/later-stack')}
          >
            <Image
              source={require('@/assets/icons/calendar.png')}
              style={styles.menuIcon}
              resizeMode="contain"
            />
            <Text style={styles.menuItemText}>All Tasks</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigateTo('/archive')}
          >
            <Image
              source={require('@/assets/icons/calendar.png')}
              style={styles.menuIcon}
              resizeMode="contain"
            />
            <Text style={styles.menuItemText}>Archive</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.logoutContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#3800FF" style={styles.menuIcon} />
            <Text style={styles.menuItemText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    // Header height is excluded from the container
    paddingTop: 80, // Adjust this value based on your header height
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  drawer: {
    position: 'absolute',
    top: 80, // Start below header
    left: 0,
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  menuItems: {
    flex: 1,
    justifyContent: 'center', // Center vertically
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  logoutContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  menuItem: {
    paddingVertical: 15,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 20,
    letterSpacing: 0,
    color: '#3800FF',
  },
});

export default DrawerMenu; 