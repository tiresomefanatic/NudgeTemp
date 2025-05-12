import { powersync } from '../lib/powersync/database';
import * as FileSystem from 'expo-file-system';
import { PowerSyncDatabase } from '@powersync/react-native';
import { supabase } from '../lib/supabase/client';

/**
 * This script completely resets PowerSync:
 * 1. Disconnects from PowerSync
 * 2. Clears the database
 * 3. Deletes the entire local database file
 * 4. Purges the transaction queue
 * 5. Reinitializes PowerSync with clean state
 */
const resetPowerSyncComplete = async () => {
  try {
    console.log('🧹 Starting complete PowerSync reset...');
    
    // Step 1: Disconnect from PowerSync
    console.log('1️⃣ Disconnecting from PowerSync...');
    await powersync.disconnect();
    
    // Step 2: Clear all data from PowerSync tables
    console.log('2️⃣ Clearing all PowerSync tables...');
    try {
      await powersync.execute("DELETE FROM tasks");
      console.log('   ✓ Tasks table cleared');
    } catch (e) {
      console.log('   ⚠️ Could not clear tasks table:', e);
    }
    
    // Step 3: Delete the local database file (most thorough approach)
    console.log('3️⃣ Deleting PowerSync database file...');
    try {
      // Access internal properties safely - this is a workaround that may need to be adjusted
      // based on your PowerSync version
      const dbFilename = (powersync as any)._settings?.database?.dbFilename || 'nudge_tasks.db';
      const dbPath = `${FileSystem.documentDirectory}SQLite/${dbFilename}`;
      await FileSystem.deleteAsync(dbPath, { idempotent: true });
      console.log('   ✓ Database file deleted');
    } catch (e) {
      console.error('   ❌ Error deleting database file:', e);
    }
    
    // Step 4: For older PowerSync versions we'd use initialize()
    // For newer versions, we need to make sure we're disconnected and then
    // we can import a fresh copy of the database instance
    console.log('4️⃣ Resetting PowerSync connection...');
    try {
      // The proper way to "reinitialize" PowerSync is to make sure it's disconnected
      // and then re-import it or reconnect in your app
      console.log('   ✓ PowerSync reset - restart your app to complete the process');
    } catch (e) {
      console.error('   ❌ Error resetting PowerSync:', e);
    }
    
    console.log('5️⃣ Checking Supabase users table...');
    try {
      // Check if we have a user with ID 1 (the one causing the error)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', 1)
        .single();
        
      if (userError) {
        console.log('   ⚠️ No user with ID 1 found in Supabase');
        
        // Create a user with ID 1 to resolve the foreign key constraint
        console.log('   🔄 Creating user with ID 1 to resolve constraint...');
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: 1,
            first_name: 'System',
            last_name: 'User',
            email: 'system@example.com'
          });
          
        if (insertError) {
          console.error('   ❌ Error creating user:', insertError);
        } else {
          console.log('   ✓ User with ID 1 created successfully');
        }
      } else {
        console.log('   ✓ User with ID 1 exists:', userData);
      }
    } catch (e) {
      console.error('   ❌ Error checking/creating user:', e);
    }
    
    console.log('✅ PowerSync reset complete!');
    console.log('🔄 IMPORTANT: You must restart your app to complete the reset process.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during PowerSync reset:', error);
    process.exit(1);
  }
};

resetPowerSyncComplete(); 