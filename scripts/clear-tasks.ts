import './load-env';
import { clearAllTasks } from '../lib/powersync/taskService';

async function resetDatabase() {
  console.log('Starting database reset...');
  
  try {
    // Clear all tasks
    await clearAllTasks();
    console.log('Database reset complete - all tasks have been removed.');
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  }
}

// Run the reset
resetDatabase();
