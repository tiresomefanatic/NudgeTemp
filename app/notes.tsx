import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams, Redirect } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from "@/lib/auth/AuthContext";

// Define chat message type
interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  date: string;
  isSelf: boolean;
  isVoiceNote?: boolean;
}

// Mock data for the chat
const mockChatData: ChatMessage[] = [
  {
    id: '1',
    sender: 'A',
    message: 'Created this task & assigned it to you and Pete',
    timestamp: 'Yesterday',
    date: 'Yesterday',
    isSelf: false
  },
  {
    id: '2',
    sender: 'A',
    message: 'Sam, Pete, please take care of this. It is imp',
    timestamp: 'Yesterday',
    date: 'Yesterday',
    isSelf: false
  },
  {
    id: '3',
    sender: 'P',
    message: '',
    timestamp: '00:42',
    date: 'Yesterday',
    isSelf: false,
    isVoiceNote: true
  },
  {
    id: '4',
    sender: 'S',
    message: 'Remind me on Wednesday to do this please :)',
    timestamp: '3:58 PM',
    date: 'Today',
    isSelf: true
  },
  {
    id: '5',
    sender: 'S',
    message: '',
    timestamp: '00:42',
    date: 'Today',
    isSelf: true,
    isVoiceNote: true
  }
];

export default function NotesScreen() {
  const { session } = useAuth();
  const { taskId, taskTitle } = useLocalSearchParams();
  const [inputText, setInputText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Redirect to auth if not logged in
  if (!session) {
    return <Redirect href="/(auth)" />;
  }
  
  // Function to navigate back
  const navigateBack = () => {
    Haptics.selectionAsync();
    router.back();
  };

  // Scroll to bottom on load
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  // Handle sending a message
  const handleSendMessage = () => {
    if (inputText.trim() === '') return;
    
    
    // Clear input
    setInputText('');
    
    // Unfocus the input
    Keyboard.dismiss();
  };

  // Render the message bubble based on type
  const renderMessageBubble = (item: ChatMessage) => {
    if (item.isVoiceNote) {
      return (
        <View style={[styles.messageBubble, item.isSelf ? styles.selfMessageBubble : styles.receivedMessageBubble]}>
          <View style={styles.voiceNoteContainer}>
            <TouchableOpacity style={styles.playButton}>
              <Image source={require('@/assets/icons/Chat.png')} style={styles.playIcon} />
            </TouchableOpacity>
            <Text style={styles.messageText}>|</Text>
            <Text style={styles.voiceTime}>{item.timestamp}</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={[styles.messageBubble, item.isSelf ? styles.selfMessageBubble : styles.receivedMessageBubble]}>
        <Text style={styles.messageText}>{item.message}</Text>
        <Text style={styles.messageTimestamp}>{item.timestamp}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />

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
            <Text style={styles.headerTitle}>Notes</Text>
          </View>
        </View>
      </RNSafeAreaView>

      {/* Main content */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Chat messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Group messages by date */}
          {mockChatData.map((item, index) => {
            // Check if we need to show a date separator
            const showDateSeparator = index === 0 || 
              item.date !== mockChatData[index - 1].date;
            
            return (
              <View key={item.id}>
                {/* Date separator */}
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <Text style={styles.dateSeparatorText}>{item.date}</Text>
                  </View>
                )}
                
                {/* Message */}
                <View style={[styles.messageRow, item.isSelf ? styles.selfMessageRow : styles.receivedMessageRow]}>
                  {/* Left avatar (only for received messages) */}
                  {!item.isSelf && (
                    <View style={styles.leftAvatar}>
                      <Text style={styles.avatarText}>{item.sender}</Text>
                    </View>
                  )}
                  
                  {/* Message content */}
                  {renderMessageBubble(item)}
                  
                  {/* Right avatar (only for self messages) */}
                  {item.isSelf && (
                    <View style={styles.rightAvatar}>
                      <Text style={styles.avatarText}>{item.sender}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
        
        {/* Input box */}
        <View style={styles.inputContainer}>
          {isInputFocused ? (
            <View style={styles.inputBarFocused}>
              <TextInput
                style={styles.textInputFocused}
                placeholder="Type your notes..."
                placeholderTextColor="#9CA0AA"
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                multiline
              />
              <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
                <Image source={require('@/assets/icons/Send.png')} style={styles.sendIcon} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                placeholder="Type your notes..."
                placeholderTextColor="#9CA0AA"
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setIsInputFocused(true)}
                multiline
              />
              <View style={styles.inputIcons}>
                <TouchableOpacity style={styles.inputIconButton}>
                  <Image source={require('@/assets/icons/Microphone.png')} style={styles.inputIcon} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inputIconButton}>
                  <Image source={require('@/assets/icons/Camera.png')} style={styles.inputIcon} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    justifyContent: "flex-start",
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
  },
  headerTitle: {
    fontFamily: 'Sharpie',
    fontWeight: '500',
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: 0.15,
    color: '#3800FF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatContent: {
    paddingVertical: 12,
  },
  dateSeparator: {
    display: 'flex',
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D3D5D9',
    backgroundColor: '#F4F4F6',
  },
  dateSeparatorText: {
    color: '#717683',
    fontFamily: 'Urbanist',
    fontSize: 14,
    fontWeight: '400',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  selfMessageRow: {
    justifyContent: 'flex-end',
  },
  receivedMessageRow: {
    justifyContent: 'flex-start',
  },
  leftAvatar: {
    display: 'flex',
    width: 32,
    height: 32,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#1249D3',
    marginRight: 8,
  },
  rightAvatar: {
    display: 'flex',
    width: 32,
    height: 32,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    marginLeft: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  messageBubble: {
    display: 'flex',
    minHeight: 44,
    maxWidth: 240,
    padding: 8,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    flex: 1,
    borderRadius: 8,
  },
  receivedMessageBubble: {
    borderWidth: 1,
    borderColor: '#6990F2',
    backgroundColor: 'rgba(180, 199, 248, 0.40)',
  },
  selfMessageBubble: {
    borderWidth: 1,
    borderColor: '#FFE97A',
    backgroundColor: '#FFF6CC',
    alignItems: 'flex-end',
  },
  messageText: {
    color: '#717683',
    fontFamily: 'Urbanist',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  messageTimestamp: {
    color: '#9CA0AA',
    fontFamily: 'Urbanist',
    fontSize: 12,
    fontWeight: '400',
    alignSelf: 'flex-end',
  },
  voiceNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  playButton: {
    marginRight: 8,
  },
  playIcon: {
    width: 24,
    height: 24,
  },
  voiceTime: {
    color: '#9CA0AA',
    fontFamily: 'Urbanist',
    fontSize: 12,
    fontWeight: '400',
    marginLeft: 'auto',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  inputBar: {
    display: 'flex',
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DEDFE3',
    backgroundColor: '#FFF',
  },
  inputBarFocused: {
    display: 'flex',
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DEDFE3',
    backgroundColor: '#FFF',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#717683',
    fontFamily: 'Urbanist',
    paddingVertical: 0,
  },
  textInputFocused: {
    flex: 1,
    fontSize: 16,
    color: '#717683',
    fontFamily: 'Urbanist',
    paddingVertical: 0,
  },
  inputIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputIconButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputIcon: {
    width: 24,
    height: 24,
  },
  sendButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    width: 24,
    height: 24,
  },
}); 