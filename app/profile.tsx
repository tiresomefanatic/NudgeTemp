import React from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
export default function ProfileScreen() {
  const goBack = () => {
    router.back();
  };
  const navigateToResetScreen = () => {
    Haptics.selectionAsync();
    router.push("/reset");
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

      {/* Header inside SafeAreaView */}
      <RNSafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.customHeader}>
          <TouchableOpacity style={styles.headerIconLeft} onPress={goBack}>
            <Image
              source={require("@/assets/icons/BackArrow.png")}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.headerTitleLeft}>
            <Text style={styles.headerTitle}>profile</Text>
          </View>
        </View>
      </RNSafeAreaView>

      <View style={styles.content}>
        <Text style={styles.profileText}>Profile Page</Text>
        <Text style={styles.descriptionText}>Your profile information will appear here.</Text>
      </View>
      
      <View>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={navigateToResetScreen}
        >
          <Ionicons name="trash-outline" size={16} color="#ff4d4f" />
          <Text style={styles.resetButtonText}>Reset Database</Text>
        </TouchableOpacity>
      </View>  
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Sharpie',
    fontWeight: '400',
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.15,
    color: '#3800FF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  profileText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 20,
    color: '#3800FF',
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 77, 79, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 16,
  },
  resetButtonText: {
    color: "#ff4d4f",
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
  },
}); 