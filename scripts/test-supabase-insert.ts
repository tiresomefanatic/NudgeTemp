import './load-env';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

async function testSupabaseInsert() {
  console.log('Testing direct task insertion to Supabase...');
  
  try {
    // Create a new Supabase client without AsyncStorage
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Create a test task record
    const currentTime = new Date().toISOString();
    const taskId = uuidv4();
    
    const newTask = {
      id: taskId,
      title: 'Test Task ' + currentTime.substring(11, 19), // Use time as part of title for uniqueness
      description: 'This is a test task inserted directly to Supabase',
      priority: 'medium',
      created_at: currentTime,
      completed_at: null,
      postponed_at: null,
      postponed_count: 0,
      user_id: 'test-user',
      is_completed: 0,
      is_postponed: 0
    };
    
    // Insert the task
    console.log('Inserting task with ID:', taskId);
    const { data, error } = await supabase.from('tasks').insert(newTask).select();
    
    if (error) {
      console.error('❌ Task insertion failed:', error.message);
      console.error('Error details:', error);
      
      // Check common issues
      if (error.message.includes('duplicate key')) {
        console.warn('⚠️ A task with this ID already exists');
      } else if (error.message.includes('foreign key')) {
        console.warn('⚠️ The task references a user_id that might not exist');
      }
    } else {
      console.log('✅ Task inserted successfully!');
      console.log('Inserted data:', data);
      
      // Now try to query the task to confirm it exists
      const { data: queryData, error: queryError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId);
      
      if (queryError) {
        console.error('❌ Failed to query inserted task:', queryError.message);
      } else {
        console.log('✅ Successfully queried inserted task:');
        console.log(queryData);
      }
    }
  } catch (error: any) {
    console.error('❌ Unexpected error during task insertion:', error?.message || 'Unknown error');
  }
}

// Run the test
testSupabaseInsert();
