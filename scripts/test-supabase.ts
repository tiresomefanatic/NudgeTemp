import './load-env';
import { createClient } from '@supabase/supabase-js';

async function testSupabase() {
  console.log('Testing Supabase connection...');
  try {
    // Create a new Supabase client without AsyncStorage
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.from('tasks').select('*').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connection successful!');
    console.log('Sample data:', data);
  } catch (error: any) {
    console.error('❌ Supabase connection failed:', error?.message || 'Unknown error');
  }
}

testSupabase();
