import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../lib/auth/AuthContext";
import SocialAuthButtons from "../(auth)/SocialAuthButtons";
import { Colors } from "../../constants/Colors"; 
import { Ionicons } from '@expo/vector-icons'; 

// For the OTP input bottom sheet 
import Modal from "react-native-modal";

const screenHeight = Dimensions.get("window").height;

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91"); // Default country code
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpError, setOtpError] = useState(false);

  const { signInWithPhone, verifyOtp } = useAuth();
  const otpInputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!phoneNumber) {
      Alert.alert("Missing field", "Please enter your mobile number.");
      return;
    }
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    setIsLoading(true);
    const { error } = await signInWithPhone(fullPhoneNumber);
    setIsLoading(false);
    if (error) {
      Alert.alert("Failed to send OTP", error.message);
    } else {
      setIsOtpSent(true);
      setResendTimer(16); // Start 16 second timer
      setOtpError(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP.");
      setOtpError(true);
      return;
    }
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    setIsLoading(true);
    const { error, data } = await verifyOtp(fullPhoneNumber, otpCode);
    setIsLoading(false);
    if (error || !data?.session) {
      Alert.alert("OTP Verification Failed", error?.message || "Invalid OTP. Please try again.");
      setOtpError(true);
      setOtp(Array(6).fill("")); // Clear OTP fields
      otpInputRefs.current[0]?.focus();
    } else {
      setOtpError(false);
      // Navigation to enter-name is handled in AuthContext
      console.log("OTP Verified, session:", data.session);
    }
  };

  const handleResendOtp = () => {
    if (resendTimer === 0) {
      handleSendOtp();
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setOtpError(false); // Reset error state on input change

    if (text && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    } 
    // If all fields are filled, attempt to verify
    if (newOtp.every(val => val !== '') && newOtp.length === 6) {
        // Automatically trigger verify if all filled - User might not want this immediately
        // handleVerifyOtp(); // Consider if this is good UX
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const renderOtpInputs = () => {
    return otp.map((digit, index) => (
      <TextInput
        key={index}
        ref={(ref) => (otpInputRefs.current[index] = ref)}
        style={[styles.otpInput, otpError ? styles.otpInputError : (otp.join('').length === 6 && !otpError ? styles.otpInputSuccess: {})]}
        keyboardType="number-pad"
        maxLength={1}
        onChangeText={(text) => handleOtpChange(text, index)}
        onKeyPress={(e) => handleOtpKeyPress(e, index)}
        value={digit}
      />
    ));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {!isOtpSent ? (
          <View style={styles.loginContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.logo}>nudge</Text>
            </View>
            <View style={styles.formContainer}>
              <Text style={styles.loginTitle}>Log in or Sign Up</Text>
              <View style={styles.phoneInputContainer}>
                <TouchableOpacity style={styles.countryCodeContainer}>
                  <Text style={styles.countryCodeText}>{countryCode}</Text>
                  <Ionicons name="caret-down" size={16} color={Colors.light.text} />
                </TouchableOpacity>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter mobile number"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Log In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // This will be replaced by a proper bottom sheet/modal
          <View style={styles.otpScreenContainer}> 
            <View style={styles.headerContainerOtp}>
                <Text style={styles.logo}>nudge</Text>
            </View>
            <View style={styles.otpFormContainer}>
                <Text style={styles.otpTitle}>Enter verification code</Text>
                <View style={styles.sentToContainer}>
                    <Text style={styles.otpSubtitle}>Sent to {`${countryCode} ${phoneNumber}`}</Text>
                    <TouchableOpacity onPress={() => setIsOtpSent(false)}>
                        <Ionicons name="pencil" size={18} color={Colors.light.primary} />
                    </TouchableOpacity>
                </View>
                <View style={styles.otpInputRow}>{renderOtpInputs()}</View>
                {otp.join('').length === 6 && !isLoading && (
                     <TouchableOpacity
                        style={[styles.button, styles.verifyButton, isLoading && styles.buttonDisabled]} // Added verifyButton style
                        onPress={handleVerifyOtp}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                        <ActivityIndicator color="#fff" />
                        ) : (
                        <Text style={styles.buttonText}>Verify OTP</Text>
                        )}
                  </TouchableOpacity>
                )}
                <Text style={styles.resendText}>
                Get verification code again in{" "}
                {resendTimer > 0 ? (
                    <Text style={styles.timerText}>{`00:${resendTimer < 10 ? "0" : ""}${resendTimer}`}</Text>
                ) : (
                    <TouchableOpacity onPress={handleResendOtp} disabled={resendTimer > 0}>
                    <Text style={[styles.resendLink, resendTimer > 0 && styles.disabledLink]}>Resend Code</Text>
                    </TouchableOpacity>
                )}
                </Text>
                {/* Numeric Keypad - Placeholder, typically handled by keyboardType="number-pad" for OTP or custom component for exact Figma style */}
                 {/* <View style={styles.keypadContainer}> 
                     <Text>Numeric Keypad would be here if not using system default</Text>
                 </View> */}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary, 
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "flex-end", 
  },
  // Login Screen Styles
  loginContainer: {
    height: '100%',
    justifyContent: 'space-between'
  },
  headerContainer: {
    flex: 0.6, 
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60, 
  },
  logo: {
    fontSize: 60, 
    fontWeight: "bold",
    color: "#fff",
    fontFamily: "System", 
  },
  formContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 30,
    paddingVertical: 40, 
    alignItems: "center",
  },
  loginTitle: {
    fontSize: 20, 
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 20,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    height: 50,
    borderColor: Colors.light.border,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 20,
    paddingHorizontal: 5, 
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: Colors.light.border,
    height: '70%',
  },
  countryCodeText: {
    fontSize: 16,
    marginRight: 5,
    color: Colors.light.text,
  },
  phoneInput: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.light.text,
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

  // OTP Screen Styles 
  otpScreenContainer: {
    flex:1, 
    backgroundColor: Colors.light.primary,
  },
  headerContainerOtp: {
    height: screenHeight * 0.3, 
    justifyContent: "center",
    alignItems: "center",
  },
  otpFormContainer: {
    height: screenHeight * 0.7, 
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 30,
    paddingTop: 30, 
    alignItems: "center",
  },
  otpTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.light.primary, 
    marginBottom: 10,
  },
   sentToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 25,
  },
  otpSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    textAlign: 'left',
  },
  otpInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 20,
    color: Colors.light.text,
    backgroundColor: '#F7F7F7' 
  },
  otpInputError: {
    borderColor: Colors.light.danger, 
    color: Colors.light.danger,
  },
  otpInputSuccess: {
    borderColor: Colors.light.success, 
    color: Colors.light.success,
  },
  verifyButton: {
      backgroundColor: Colors.light.primary, 
  },
  resendText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 20,
    textAlign: "center",
  },
  timerText: {
    color: Colors.light.primary, 
    fontWeight: "bold",
  },
  resendLink: {
    color: Colors.light.primary, 
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
  disabledLink: {
    color: Colors.light.textPlaceholder, 
    textDecorationLine: "none",
  },
  // Placeholder for keypad, if you decide to build a custom one
  // keypadContainer: {
  //   marginTop: 20,
  //   alignItems: 'center',
  //   width: '100%',
  // }
});
