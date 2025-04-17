import { powersync } from './database';
import { SupabaseConnector } from './connector';

// PowerSync configuration
const POWERSYNC_URL = process.env.POWERSYNC_URL || 'http://localhost:3000';

// Initialize and connect PowerSync
export const setupPowerSync = async () => {
  try {
    console.log('🔄 Initializing PowerSync...');
    // Create a new connector instance
    const connector = new SupabaseConnector(POWERSYNC_URL);
    
    // Connect PowerSync with the connector
    await powersync.connect(connector);
    
    // Watch for changes in tasks table
    await powersync.execute(
      `CREATE TRIGGER IF NOT EXISTS log_task_changes
       AFTER INSERT OR UPDATE OR DELETE ON tasks
       BEGIN
         SELECT CASE
           WHEN NEW.id IS NOT NULL AND OLD.id IS NULL THEN
             (SELECT printf('🟢 Task created: %s', NEW.title))
           WHEN NEW.id IS NULL AND OLD.id IS NOT NULL THEN
             (SELECT printf('🔴 Task deleted: %s', OLD.title))
           WHEN NEW.is_completed = 1 AND OLD.is_completed = 0 THEN
             (SELECT printf('✅ Task completed: %s', NEW.title))
           WHEN NEW.is_postponed = 1 AND OLD.is_postponed = 0 THEN
             (SELECT printf('⏳ Task postponed: %s', NEW.title))
           ELSE
             (SELECT printf('📝 Task updated: %s', NEW.title))
         END;
       END;`
    );
    
    console.log('✅ PowerSync initialized successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Error setting up PowerSync:', error?.message || 'Unknown error');
    return false;
  }
};

// Clean up PowerSync resources
export const cleanupPowerSync = async () => {
  try {
    await powersync.disconnect();
    console.log('PowerSync disconnected');
  } catch (error) {
    console.error('Error disconnecting PowerSync:', error);
  }
};
