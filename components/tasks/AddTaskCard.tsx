import React, { useState } from "react";
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
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = height * 0.8;

interface AddTaskCardProps {
  title: string;
  setTitle: (v: string) => void;
  details: string;
  setDetails: (v: string) => void;
}

export const AddTaskCard: React.FC<AddTaskCardProps> = ({ title, setTitle, details, setDetails }) => {
  const [contributors, setContributors] = useState<string[]>(["Alice", "Rachel"]);
  const [dueDate, setDueDate] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedRepeat, setSelectedRepeat] = useState<'Daily' | 'Weekly' | 'Monthly'>('Weekly');
  const [monthOffset, setMonthOffset] = useState(0);

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

  return (
    <View style={styles.card}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* Title */}
        <Text style={styles.titleLabel}>Enter a task title</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="By Alice"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#a5b4fc"
        />
        {/* Contributors */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>CONTRIBUTORS</Text>
          <TouchableOpacity style={styles.addBtn}>
            <Image 
              source={require('@/assets/icons/Add.png')} 
              style={{ width: 16, height: 16 }} 
              resizeMode="contain"
            />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contributorsRow}>
          {contributors.map((c) => (
            <View key={c} style={styles.contributorPill}>
              <Text style={styles.contributorPillText}>{c}</Text>
            </View>
          ))}
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
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#191919",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    alignSelf: "center",
    padding: 20,
  },
  titleLabel: {
    fontSize: 24,
    fontFamily: 'Pally',
    color: '#A79EFF',
    lineHeight: 32,
    letterSpacing: 0.15,
    marginBottom: 4,
  },
  titleInput: {
    fontSize: 14,
    fontWeight: '400',
    color: '#868B97',
    fontFamily: 'Urbanist',
    borderBottomWidth: 1,
    borderColor: '#0000001A',
    marginBottom: 2,
    paddingVertical: 4,
    lineHeight: 21,
  },
  byText: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 14,
    fontFamily: 'Kalam',
    fontWeight: '400',
    color: '#B2B5BD',
    lineHeight: 16,
    letterSpacing: 0.15,
    marginBottom: 4,
    marginTop: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
    gap: 8,
    marginBottom: 24,
  },
  contributorPill: {
    borderWidth: 1,
    borderColor: '#1A0075',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contributorPillText: {
    fontWeight: '600',
    fontStyle: 'italic',
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
});

export default AddTaskCard; 