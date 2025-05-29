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
  const [focusedOtpIndex, setFocusedOtpIndex] = useState(-1);

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

  const handleVerifyOtp = async (otpCode?: string) => {
    const codeToVerify = otpCode || otp.join("");
    if (codeToVerify.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP.");
      setOtpError(true);
      return;
    }
    const fullPhoneNumber = `${countryCode}${phoneNumber}`;
    setIsLoading(true);
    const { error, data } = await verifyOtp(fullPhoneNumber, codeToVerify);
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
    // If all fields are filled, attempt to verify automatically
    if (newOtp.every(val => val !== '') && newOtp.length === 6) {
        const completeOtp = newOtp.join("");
        handleVerifyOtp(completeOtp);
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
        style={[
          styles.otpInput, 
          focusedOtpIndex === index ? styles.otpInputFocused : {},
          otpError ? styles.otpInputError : {},
          (otp.join('').length === 6 && !otpError ? styles.otpInputSuccess : {})
        ]}
        keyboardType="number-pad"
        maxLength={1}
        onChangeText={(text) => handleOtpChange(text, index)}
        onKeyPress={(e) => handleOtpKeyPress(e, index)}
        onFocus={() => setFocusedOtpIndex(index)}
        onBlur={() => setFocusedOtpIndex(-1)}
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
              <View style={styles.phoneInputRow}>
                <TouchableOpacity style={styles.countryCodeBlock}>
                  <Text style={styles.countryCodeText}>{countryCode}</Text>
                  <Ionicons name="caret-down" size={16} color="#5E626E" />
                </TouchableOpacity>
                <TextInput
                  style={styles.mobileInputBlock}
                  placeholder="Enter mobile number"
                  placeholderTextColor="#5E626E"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Log in</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.otpScreenContainer}> 
            <View style={styles.headerContainerOtp}>
                <Text style={styles.logo}>nudge</Text>
            </View>
            <View style={styles.otpFormContainer}>
                <View style={styles.otpTopContent}>
                  <Text style={styles.otpTitle}>Enter verification code</Text>
                  <View style={styles.sentToContainer}>
                      <Text style={styles.sentToText}>Sent to </Text><Text style={styles.phoneNumberText}>{`${countryCode} ${phoneNumber}`}</Text>
                      <TouchableOpacity onPress={() => setIsOtpSent(false)}>
                          <Ionicons name="pencil" size={18} color={Colors.light.primary} />
                      </TouchableOpacity>
                  </View>
                  <View style={styles.otpInputRow}>{renderOtpInputs()}</View>
                  {otpError && (
                    <Text style={styles.otpErrorText}>
                      Uh Oh! The OTP you entered is invalid.
                    </Text>
                  )}
                </View>
                
                <View style={styles.bottomContainer}>
                  {resendTimer > 0 ? (
                    <Text style={styles.resendText}>
                      Get verification code again in{" "}
                      <Text style={styles.timerText}>{`00:${resendTimer < 10 ? "0" : ""}${resendTimer}`}</Text>
                    </Text>
                  ) : null}
                  
                  <TouchableOpacity
                    style={[
                      styles.resendButton, 
                      resendTimer > 0 ? styles.resendButtonDisabled : styles.resendButtonEnabled
                    ]}
                    onPress={handleResendOtp}
                    disabled={resendTimer > 0}
                  >
                    <Text style={styles.resendButtonText}>Resend Code</Text>
                  </TouchableOpacity>
                </View>
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
    color: "#FFF",
    fontFamily: "Sharpie",
    fontSize: 72,
    fontStyle: "normal",
    fontWeight: 500,
    lineHeight: 72, 
    letterSpacing: 0.338,
  },
  formContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  loginTitle: {
    color: "#5a52ff", 
    fontFamily: "Be Vietnam",
    fontSize: 24,
    fontStyle: "normal",
    fontWeight: 700,
    lineHeight: 32, 
    letterSpacing: -0.25,
    textAlign: "center",
    marginBottom: 20,
  },
  phoneInputRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8, 
  },
  countryCodeBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#B2B5BD",
    backgroundColor: "#FFF",
    height: 48,
    width: 86,
  },
  countryCodeText: {
    color: "#5E626E",
    fontFamily: "Urbanist",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 22,
    marginRight: 8,
  },
  mobileInputBlock: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#B2B5BD",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    height: 48,
    color: "#5E626E",
    fontFamily: "Urbanist",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "400",
    lineHeight: 22,
  },
  loginButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: "#3800FF",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: Colors.light.lightGray, 
  },
  loginButtonText: {
    color: "#FFF",
    fontFamily: "Be Vietnam",
    fontSize: 16,
    fontStyle: "normal",
    fontWeight: "300",
    lineHeight: 20,
    letterSpacing: 0,
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
    paddingHorizontal: 16,
    paddingTop: 16, 
    alignItems: "center",
    justifyContent: "space-between",
  },
  otpTopContent: {
    width: '100%',
  },
  otpTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.primary,
    fontFamily: "Be Vietnam",
    lineHeight: 32,
    letterSpacing: -0.25,
    marginBottom: 6,
  },
   sentToContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  sentToText: {
    fontSize: 14,
    color: '#5E626E',
    fontFamily: 'Be Vietnam',
    fontWeight: '300',
    lineHeight: 20,
    letterSpacing: 0,
  },
  phoneNumberText: {
    fontSize: 14,
    color: '#5E626E',
    fontFamily: 'Be Vietnam',
    fontWeight: '700',
    lineHeight: 16,
    letterSpacing: 0,
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
    borderWidth: 1.5,
    borderColor: '#DEDFE3',
    borderRadius: 12,
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textAlign: "center",
    fontSize: 20,
    color: Colors.light.text,
  },
  otpInputError: {
    borderColor: Colors.light.danger, 
    color: Colors.light.danger,
  },
  otpInputSuccess: {
    borderColor: Colors.light.success, 
    color: Colors.light.success,
  },
  otpInputFocused: {
    borderColor: Colors.light.otpFocus,
  },
  otpErrorText: {
    color: Colors.light.danger,
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 12,
    marginBottom: 20,
    textAlign: "center",
  },
  bottomContainer: {
    width: "100%",
    alignItems: "flex-start",
  },
  resendText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  timerText: {
    color: Colors.light.primary, 
    fontWeight: "bold",
  },
  resendButton: {
    width: "100%",
    height: 48,
    backgroundColor: "#B2B5BD",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  resendButtonText: {
    color: "#FFF",
    fontFamily: "Be Vietnam",
    fontSize: 16,
    fontWeight: "300",
    lineHeight: 20,
    letterSpacing: 0,
  },
  resendButtonDisabled: {
    backgroundColor: "#B2B5BD",
  },
  resendButtonEnabled: {
    backgroundColor: "#3800FF",
  },
});
