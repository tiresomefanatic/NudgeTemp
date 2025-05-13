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

export default function ProfileScreen() {
  const goBack = () => {
    router.back();
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
          <View style={styles.headerTitleContainer}>
            <Text style={styles.nudgeTitle}>profile</Text>
          </View>
        </View>
      </RNSafeAreaView>

      <View style={styles.content}>
        <Text style={styles.profileText}>Profile Page</Text>
        <Text style={styles.descriptionText}>Your profile information will appear here.</Text>
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
  headerTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  nudgeTitle: {
    fontFamily: 'Sharpie',
    fontWeight: '400',
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.15,
    textAlign: 'center',
    color: '#3800FF',
    flex: 1,
    width: '100%',
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
}); 