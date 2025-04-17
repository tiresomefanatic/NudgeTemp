import React from 'react';
import { Switch, View, Text, StyleSheet, Platform } from 'react-native';
import { usePowerSyncApp } from '@/lib/powersync/provider';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSymbol } from './IconSymbol';

/**
 * Component that displays a toggle for PowerSync offline mode
 */
export function OfflineModeToggle() {
  const { offlineMode, toggleOfflineMode } = usePowerSyncApp();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <IconSymbol 
          name={offlineMode ? "wifi.slash" : "wifi"} 
          size={20} 
          color={offlineMode ? '#f44336' : '#4caf50'} 
          style={styles.icon}
        />
        <Text 
          style={[
            styles.label, 
            { color: colors.text }
          ]}
        >
          Offline Mode
        </Text>
      </View>
      <Switch
        value={offlineMode}
        onValueChange={toggleOfflineMode}
        trackColor={{ 
          false: Platform.OS === 'ios' ? undefined : '#767577', 
          true: colors.tint 
        }}
        thumbColor={Platform.OS === 'ios' 
          ? undefined 
          : offlineMode 
            ? colors.tint 
            : '#f4f3f4'
        }
        ios_backgroundColor="#3e3e3e"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(150, 150, 150, 0.1)',
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
});
