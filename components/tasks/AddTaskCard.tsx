import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Switch,
  Dimensions,
  ScrollView,
  Image,
  Modal,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useCurrentUser, useAllUsers, User } from "@/lib/powersync/userService";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = height * 0.8;

interface AddTaskCardProps {
  title: string;
  setTitle: (v: string) => void;
  details: string;
  setDetails: (v: string) => void;
  contributorIds?: number[];
  setContributorIds?: (ids: number[]) => void;
}

export const AddTaskCard: React.FC<AddTaskCardProps> = ({ 
  title, 
  setTitle, 
  details, 
  setDetails,
  contributorIds = [],
  setContributorIds = () => {},
}) => {
  const { user: currentUser, loading: loadingCurrentUser } = useCurrentUser();
  const { users, loading: loadingUsers } = useAllUsers();
  
  const [dueDate, setDueDate] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRepeat, setSelectedRepeat] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  const [monthOffset, setMonthOffset] = useState(0);
  const [isAddFriendsModalVisible, setIsAddFriendsModalVisible] = useState(false);

  // Get users who are already selected as contributors
  const selectedContributors = users.filter(user => contributorIds.includes(user.id));
  
  // Helper to get days for the current week
  const getWeekDays = (baseDate: Date, weekOffset: number) => {
    const date = new Date(baseDate);
    // Set to start of week (Monday)
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(date.setDate(diff));
    monday.setDate(monday.getDate() + weekOffset * 7);
    const days: { date: Date; label: string; day: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: d,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
        day: `${d.getDate()}${d.getDate() === 1 ? 'st' : d.getDate() === 2 ? 'nd' : d.getDate() === 3 ? 'rd' : 'th'}`,
      });
    }
    const month = monday.toLocaleDateString('en-US', { month: 'long' });
    return { days, month };
  };
  const [weekOffset, setWeekOffset] = useState(0);
  const { days: weekDays, month: weekMonth } = getWeekDays(new Date(), weekOffset);

  const today = new Date();

  // Custom Toggle
  const CustomToggle = ({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={[styles.toggle, { backgroundColor: value ? '#3800FF' : '#E9EAEC', borderColor: value ? '#3800FF' : '#1A0075' }]}
    >
      <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
    </TouchableOpacity>
  );

  const handleAddContributor = (userId: number) => {
    // Don't add if already in the list
    if (contributorIds.includes(userId)) return;
    
    // Add the user ID to the contributors list
    setContributorIds([...contributorIds, userId]);
    
    // Close the modal
    setIsAddFriendsModalVisible(false);
  };

  const handleRemoveContributor = (userId: number) => {
    // Remove the user from contributors
    setContributorIds(contributorIds.filter(id => id !== userId));
  };

  const openAddFriendsModal = () => {
    setIsAddFriendsModalVisible(true);
  };

  const closeAddFriendsModal = () => {
    setIsAddFriendsModalVisible(false);
  };

  // Format user's name for display
  const formatUserName = (user: User | null): string => {
    if (!user) return 'You';
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    return user.email.split('@')[0];
  };

  // Get first letter of name for avatar
  const getNameInitial = (user: User): string => {
    if (user.first_name) {
      return user.first_name.charAt(0).toUpperCase();
    }
    return user.email.charAt(0).toUpperCase();
  };

  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    // Focus the title input when the card mounts
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, []);

  // Loading state
  if (loadingCurrentUser || loadingUsers) {
    return (
      <View style={[styles.card, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#3800FF" />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Add Friends Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isAddFriendsModalVisible}
        onRequestClose={closeAddFriendsModal}
      >
        <TouchableWithoutFeedback onPress={closeAddFriendsModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
              >
                <View style={styles.addFriendsModal}>
                  <View style={styles.modalIndicator} />
                  
                  <Text style={styles.addFriendsTitle}>Add Contributors</Text>
                  
                  <ScrollView style={styles.friendsList}>
                    {users
                      .filter(user => user.id !== currentUser?.id) // Don't show current user
                      .map((user) => (
                        <View key={user.id} style={styles.friendItem}>
                          <View style={styles.friendInfo}>
                            <View style={styles.friendAvatar}>
                              <Text style={styles.friendAvatarText}>{getNameInitial(user)}</Text>
                            </View>
                            <Text style={styles.friendName}>{formatUserName(user)}</Text>
                          </View>
                          <TouchableOpacity 
                            style={[
                              styles.addFriendButton,
                              contributorIds.includes(user.id) && styles.addFriendButtonSelected
                            ]}
                            onPress={() => contributorIds.includes(user.id) 
                              ? handleRemoveContributor(user.id)
                              : handleAddContributor(user.id)
                            }
                          >
                            <Text style={styles.addFriendButtonText}>
                              {contributorIds.includes(user.id) ? 'Remove' : 'Add'}
                            </Text>
                            <Text style={styles.addFriendButtonPlus}>
                              {contributorIds.includes(user.id) ? '-' : '+'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Title - Now this is the main input field */}
        <TextInput
          ref={titleInputRef}
          style={styles.titleInput}
          placeholder="Enter a task title"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#a5b4fc"
          autoFocus={true}
        />
        {/* By user text - Now this shows the current user */}
        <Text style={styles.byUserText}>By {formatUserName(currentUser)}</Text>
        
        {/* Contributors */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>CONTRIBUTORS</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAddFriendsModal}>
            <Image 
              source={require('@/assets/icons/Add.png')} 
              style={{ width: 16, height: 16 }} 
              resizeMode="contain"
            />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contributorsRow}>
          {selectedContributors.length > 0 ? (
            selectedContributors.map((user) => (
              <TouchableOpacity 
                key={user.id} 
                style={styles.contributorPill}
                onPress={() => handleRemoveContributor(user.id)}
              >
                <Text style={styles.contributorPillText}>
                  {formatUserName(user)}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.noContributorsText}>No contributors added yet</Text>
          )}
        </View>
        
        {/* Details */}
        <View style={styles.detailsSection}>
          <View style={styles.detailsHeaderRow}>
            <Text style={styles.sectionHeader}>DETAILS</Text>
            <View style={styles.iconColRow}>
              <Image 
                source={require('@/assets/icons/CameraBW.png')} 
                style={{ width: 32, height: 32 }} 
                resizeMode="contain"
              />
              <View style={{ width: 8 }} />
              <Image 
                source={require('@/assets/icons/MicrophoneBW.png')} 
                style={{ width: 32, height: 32 }} 
                resizeMode="contain"
              />
            </View>
          </View>
          <TextInput
            style={styles.detailsInput}
            placeholder="Enter your task details here..."
            value={details}
            onChangeText={setDetails}
            multiline
            placeholderTextColor="#868B97"
          />
        </View>
        
        {/* Toggles */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>SET DUE DATE</Text>
          <CustomToggle value={dueDate} onValueChange={setDueDate} />
        </View>
        {dueDate && (
          <View style={styles.dueDateBox}>
            <View style={styles.dueDateHeaderRow}>
              <View style={{ width: 12 }} />
              <TouchableOpacity onPress={() => setWeekOffset(w => w - 1)}>
                <Text style={styles.dueDateArrow}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={styles.dueDateMonth}>{weekMonth}</Text>
              <TouchableOpacity onPress={() => setWeekOffset(w => w + 1)}>
                <Text style={styles.dueDateArrow}>{'>'}</Text>
              </TouchableOpacity>
              <View style={{ width: 12 }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dueDateScroll} contentContainerStyle={{ alignItems: 'center' }}>
              {weekDays.map((d, idx) => {
                const isSelected = selectedDate.toDateString() === d.date.toDateString();
                return (
                  <TouchableOpacity
                    key={d.label + d.day}
                    style={[
                      styles.dueDateDay,
                      isSelected && styles.dueDateDaySelected,
                    ]}
                    onPress={() => setSelectedDate(d.date)}
                  >
                    <Text style={[
                      styles.dueDateDayLabel,
                      isSelected && styles.dueDateDayNumSelected,
                    ]}>{d.label}</Text>
                    <View style={{ height: 2 }} />
                    <Text style={[
                      styles.dueDateDayNum,
                      isSelected && styles.dueDateDayNumSelected,
                    ]}>{d.day}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>REPEATING TASK</Text>
          <CustomToggle value={repeating} onValueChange={setRepeating} />
        </View>
        {repeating && (
          <View style={styles.repeatBox}>
            <View style={styles.repeatPillsRow}>
              {['Daily', 'Weekly', 'Monthly'].map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.repeatPill,
                    selectedRepeat === opt && styles.repeatPillSelected,
                  ]}
                  onPress={() => setSelectedRepeat(opt as 'Daily' | 'Weekly' | 'Monthly')}
                >
                  <Text style={[
                    styles.repeatPillText,
                    selectedRepeat === opt && styles.repeatPillTextSelected,
                  ]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,    
    backgroundColor: "#FFF",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#717683",
    overflow: "hidden",
    shadowColor: "rgba(56, 0, 255, 0.10)",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
    alignSelf: "center",
    padding: 20,
  },
  titleInput: {
    fontSize: 24,
    fontFamily: 'Pally',
    color: '#3800FF',
    fontWeight: '600',
    lineHeight: 32,
    letterSpacing: 0.15,
    marginBottom: 4,
    borderBottomWidth: 0,
    paddingVertical: 0,
  },
  byUserText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#717683',
    fontFamily: 'Urbanist',
    marginBottom: 16,
    lineHeight: 21,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Kalam',
    fontWeight: '400',
    color: '#B2B5BD',
    lineHeight: 16,
    letterSpacing: 0.15,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    color: '#5E626E',
    fontFamily: 'Pally',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
  },
  contributorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  contributorPill: {
    borderWidth: 1,
    borderColor: '#1A0075',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  contributorPillText: {
    fontWeight: '600',
    color: '#22223b',
  },
  detailsSection: {
    marginBottom: 8,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconColRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsInput: {
    flex: 1,
    height: 20,
    fontSize: 14,
    fontFamily: 'Pally',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
    color: '#868B97',
    borderRadius: 8,
    marginRight: 8,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: 'Kalam',
    fontWeight: '400',
    color: '#B2B5BD',
    lineHeight: 16,
    letterSpacing: 0.15,
  },
  toggle: {
    height: 24,
    minWidth: 48,
    maxWidth: 48,
    minHeight: 24,
    maxHeight: 24,
    padding: 2,
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexGrow: 0,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#1A0075',
    backgroundColor: '#E9EAEC',
    justifyContent: 'flex-start',
    flexDirection: 'row',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#191919',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 4,
  },
  toggleThumbActive: {
    marginLeft: 22,
  },
  dueDateBox: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  dueDateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 0,
  },
  dueDateArrow: {
    fontSize: 24,
    color: '#868B97',
    fontWeight: '400',
    marginHorizontal: 0,
  },
  dueDateMonth: {
    fontFamily: 'Kalam',
    fontSize: 14,
    color: '#5E5E5E',
    fontWeight: '400',
    lineHeight: 16,
    letterSpacing: 0.15,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  dueDateScroll: {
    flex: 1,
  },
  dueDateDay: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 40,
    minHeight: 48,
  },
  dueDateDaySelected: {
    backgroundColor: '#3800FF',
    borderColor: '#A79EFF',
  },
  dueDateDayLabel: {
    fontFamily: 'Pally',
    fontSize: 14,
    color: '#4F4F4F',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
    textAlign: 'center',
  },
  dueDateDayNum: {
    fontFamily: 'Pally',
    fontSize: 14,
    color: '#4F4F4F',
    fontWeight: '400',
    lineHeight: 20,
    letterSpacing: 0,
    textAlign: 'center',
  },
  dueDateDayNumSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  repeatBox: {
    backgroundColor: '#fff',
  },
  repeatPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  repeatPill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1A0075',
    backgroundColor: '#fff',
    marginHorizontal: 3,
  },
  repeatPillSelected: {
    backgroundColor: '#3800FF',
    borderColor: '#1A0075',
  },
  repeatPillText: {
    fontFamily: 'Sharpie',
    fontSize: 14,
    color: '#5E626E',
    fontWeight: 'normal',
    lineHeight: 20,
    letterSpacing: 0,
  },
  repeatPillTextSelected: {
    color: '#fff',
    fontFamily: 'Sharpie',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 20,
    letterSpacing: 0,
  },
  // Add Friends Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  addFriendsModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#393B42',
    padding: 20,
    minHeight: 300,
    shadowColor: 'rgba(56, 0, 255, 0.10)',
    shadowOffset: {
      width: 0,
      height: -12,
    },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 20,
  },
  modalIndicator: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    backgroundColor: '#E6E6E6',
    borderRadius: 2,
    marginBottom: 20,
  },
  addFriendsTitle: {
    color: '#393B42',
    fontFamily: 'Space Grotesk',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    letterSpacing: 0.15,
    marginBottom: 16,
  },
  friendsList: {
    maxHeight: 400,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3800FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  friendName: {
    color: '#B2B5BD',
    fontFamily: 'Space Grotesk',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.15,
  },
  addFriendButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7267FF',
    padding: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  addFriendButtonText: {
    color: '#7267FF',
    fontFamily: 'Pally',
    fontSize: 14,
    fontWeight: '300',
    lineHeight: 20,
  },
  addFriendButtonPlus: {
    color: '#7267FF',
    fontSize: 14,
  },
  // Add new styles for the updated UI
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendButtonSelected: {
    backgroundColor: '#E9EAEC',
  },
  noContributorsText: {
    color: '#868B97',
    fontStyle: 'italic',
    marginLeft: 0,
  },
});

export default AddTaskCard; 