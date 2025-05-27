import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "../../lib/auth/AuthContext"; 
import { useRouter } from "expo-router";
import { Colors } from "../../constants/Colors"; 

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
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>What should we call you with?</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled, !name.trim() && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading || !name.trim()}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.primary} />
          ) : (
            <Text style={[styles.buttonText, !name.trim() && styles.buttonTextDisabled]}>Start Creating Tasks!</Text>
          )}
        </TouchableOpacity>
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
    flex: 0.4,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    fontSize: 60,
    fontWeight: "bold",
    color: "#fff",
    fontFamily: "System",
  },
  formContainer: {
    flex: 0.6,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 30,
    paddingTop: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 30,
    textAlign: "center",
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: Colors.light.lightGray,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  buttonTextDisabled: {
    color: Colors.light.textPlaceholder,
  }
});

export default EnterNameScreen; 