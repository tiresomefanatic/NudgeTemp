import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Link } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function ConfirmEmailScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="check-circle" size={64} color="green" />
        </View>

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.message}>
          We've sent a confirmation email to your address. Please check your
          inbox and follow the instructions to verify your account.
        </Text>

        <View style={styles.buttonContainer}>
          <Link href="login" asChild>
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Return to Login</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <Text style={styles.helperText}>
          Didn't receive an email? Check your spam folder or{" "}
          <Link href="signup">
            <Text style={styles.linkText}>try signing up again</Text>
          </Link>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: "100%",
    marginBottom: 24,
  },
  button: {
    backgroundColor: "#007AFF",
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  helperText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  linkText: {
    color: "#007AFF",
    fontWeight: "500",
  },
});
