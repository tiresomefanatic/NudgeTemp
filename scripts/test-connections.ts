import './load-env';
import { supabase } from '../lib/supabase/client';
import { setupPowerSync, cleanupPowerSync } from '../lib/powersync/setup';

async function testConnections() {
  console.log('Testing Supabase connection...');
  try {
    const { data, error } = await supabase.from('tasks').select('count').single();
    if (error) throw error;
    console.log('✅ Supabase connection successful!');
  } catch (error: any) {
    console.error('❌ Supabase connection failed:', error?.message || 'Unknown error');
  }

  console.log('\nTesting PowerSync connection...');
  try {
    const success = await setupPowerSync();
    if (success) {
      console.log('✅ PowerSync connection successful!');
      await cleanupPowerSync();
    } else {
      throw new Error('Failed to establish connection');
    }
  } catch (error: any) {
    console.error('❌ PowerSync connection failed:', error?.message || 'Unknown error');
  }
}

testConnections();
