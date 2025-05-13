import { powersync } from '../lib/powersync/database';
import * as FileSystem from 'expo-file-system';
import { DatabaseSettings } from '@powersync/react-native';

/**
 * This script deletes the local PowerSync database and recreates it
 * Use when schema changes have been made
 */
const resetDatabase = async () => {
  try {
    console.log('🧹 Disconnecting from PowerSync database...');
    await powersync.disconnect();
    
    console.log('🗑️ Deleting PowerSync database file...');
    const settings = powersync.settings as DatabaseSettings;
    const dbPath = `${FileSystem.documentDirectory}SQLite/${settings.database.dbFilename}`;
    await FileSystem.deleteAsync(dbPath, { idempotent: true });
    
    console.log('🔄 Reconnecting to PowerSync with new schema...');
    await powersync.initialize();
    
    console.log('✅ Database reset complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  }
};

resetDatabase(); 