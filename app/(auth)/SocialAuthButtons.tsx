import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";

interface SocialAuthButtonsProps {
  onGooglePress: () => void;
  onApplePress: () => void;
  isLoading: boolean;
}

/**
 * Component for social authentication buttons (Google and Apple)
 */
export default function SocialAuthButtons({
  onGooglePress,
  onApplePress,
  isLoading,
}: SocialAuthButtonsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <View style={styles.divider} />
      </View>



      {/* Apple Sign In is typically only shown on iOS devices */}
      {Platform.OS === "ios" && (
        <TouchableOpacity
          style={[styles.socialButton, styles.appleButton]}
          onPress={onApplePress}
          disabled={isLoading}
        >
          <AntDesign name="apple1" size={18} color="#000" />
          <Text style={styles.appleButtonText}>Continue with Apple</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginVertical: 20,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
    fontSize: 14,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
  },
  googleButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  appleButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
});
