import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Dimensions } from "react-native";
import { useAuth } from "../../lib/auth/AuthContext"; 
import { useRouter } from "expo-router";
import { Colors } from "../../constants/Colors"; 

const screenHeight = Dimensions.get("window").height;

const EnterNameScreen = () => {
  const [name, setName] = useState("");
  const { updateUserName, user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Name Required", "Please enter your name.");
      return;
    }
    setLoading(true);
    const { error } = await updateUserName(name.trim());
    setLoading(false);
    if (error) {
      Alert.alert("Error", "Failed to update name. Please try again.");
    } else {
      // Navigation to tasks screen is handled within updateUserName on success
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.logo}>nudge</Text>
      </View>
      <View style={styles.formContainer}>
        <View style={styles.topContent}>
          <Text style={styles.title}>Welcome!</Text>
          <Text style={styles.subtitle}>What should we call you with?</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#868B97"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>
        
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[
              styles.button, 
              loading && styles.buttonDisabled, 
              !name.trim() ? styles.buttonDisabled : styles.buttonEnabled
            ]}
            onPress={handleContinue}
            disabled={loading || !name.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Start Creating Tasks!</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
  },
  headerContainer: {
    height: screenHeight * 0.3,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    color: "#FFF",
    fontFamily: "Sharpie",
    fontSize: 72,
    fontStyle: "normal",
    fontWeight: 500,
    lineHeight: 72, 
    letterSpacing: 0.338,
  },
  formContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: "center",
    justifyContent: "space-between",
  },
  topContent: {
    width: '100%',
  },
  title: {
    color: "#5A52FF",
    fontFamily: "Be Vietnam",
    fontSize: 24,
    fontStyle: "normal",
    fontWeight: "700",
    lineHeight: 32,
    letterSpacing: -0.25,
    marginBottom: 6,
    textAlign: "left",
    width: "100%",
  },
  subtitle: {
    color: "#5E626E",
    fontFamily: "Be Vietnam",
    fontSize: 14,
    fontStyle: "normal",
    fontWeight: "300",
    lineHeight: 20,
    letterSpacing: 0,
    marginBottom: 24,
    textAlign: "left",
    width: "100%",
  },
  input: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#DEDFE3",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#868B97",
    fontFamily: "Urbanist",
    fontWeight: "400",
    lineHeight: 22,
  },
  bottomContainer: {
    width: "100%",
    alignItems: "flex-start",
  },
  button: {
    width: "100%",
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  buttonDisabled: {
    backgroundColor: "#B2B5BD",
  },
  buttonEnabled: {
    backgroundColor: "#3800FF",
  },
  buttonText: {
    color: "#FFF",
    fontFamily: "Be Vietnam",
    fontSize: 16,
    fontWeight: "300",
    lineHeight: 20,
    letterSpacing: 0,
  },
});

export default EnterNameScreen; 