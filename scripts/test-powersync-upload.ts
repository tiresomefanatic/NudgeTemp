import './load-env';
import { SupabaseConnector } from '../lib/powersync/connector';
import { powersync } from '../lib/powersync/database';
import { v4 as uuidv4 } from 'uuid';

async function testPowerSyncUpload() {
  console.log('🧪 Testing PowerSync to Supabase synchronization...');
  
  try {
    // Get the PowerSync URL
    const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL!;
    console.log('💻 Using PowerSync URL:', POWERSYNC_URL);
    
    // Create a connector instance
    const connector = new SupabaseConnector(POWERSYNC_URL);
    console.log('✅ Created SupabaseConnector instance');
    
    // Test fetching credentials
    console.log('🔑 Testing credential fetch...');
    const credentials = await connector.fetchCredentials();
    console.log('✅ Credentials received:', {
      endpoint: credentials.endpoint,
      tokenLength: credentials.token ? credentials.token.length : 0,
      tokenStart: credentials.token ? credentials.token.substring(0, 10) + '...' : 'none',
    });
    
    // Insert a test task directly into PowerSync
    const taskId = uuidv4();
    const currentTime = new Date().toISOString();
    
    console.log('📝 Inserting test task into PowerSync with ID:', taskId);
    await powersync.execute(
      `INSERT INTO tasks (
        id, title, description, priority, created_at, 
        completed_at, postponed_at, postponed_count, 
        user_id, is_completed, is_postponed
      ) VALUES (
        ?, ?, ?, ?, ?,
        NULL, NULL, 0,
        ?, 0, 0
      )`,
      [
        taskId,
        'PS Test Task ' + currentTime.substring(11, 19),
        'Task created in PowerSync for sync testing',
        'medium',
        currentTime,
        'test-user'
      ]
    );
    console.log('✅ Task inserted into PowerSync');
    
    // Verify the task was inserted into PowerSync
    const result = await powersync.execute(`SELECT * FROM tasks WHERE id = ?`, [taskId]);
    if (result.rows && result.rows.length > 0) {
      console.log('✅ Task confirmed in PowerSync:', result.rows.item(0));
    } else {
      console.error('❌ Failed to find inserted task in PowerSync');
    }
    
    // Attempt to upload the data to Supabase
    console.log('🔄 Attempting to sync task to Supabase...');
    try {
      await connector.uploadData(powersync);
      console.log('✅ PowerSync uploadData completed without errors');
    } catch (syncError) {
      console.error('❌ Error in uploadData:', syncError);
    }
    
    // Check Supabase directly to see if it was uploaded
    console.log('🔍 Checking if task was synced to Supabase...');
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data, error } = await supabase.from('tasks').select('*').eq('id', taskId);
    
    if (error) {
      console.error('❌ Error checking Supabase:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ Task successfully synced to Supabase:', data[0]);
    } else {
      console.error('❌ Task not found in Supabase after sync attempt');
    }
  } catch (error) {
    console.error('❌ Unexpected error during test:', error);
  }
}

// Run the test
testPowerSyncUpload();
