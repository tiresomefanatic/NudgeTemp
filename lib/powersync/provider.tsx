import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { powersync } from "./database";
import { SupabaseConnector } from "./connector";
import { supabase } from "../supabase/client";
import { useAuth } from "../auth/AuthContext";

// Create a simple context for PowerSync database access
interface PowerSyncAppContextType {
  isConnected: boolean;
  lastSyncAttempt: string | null;
  syncStatus: {
    initialized: boolean;
    connected: boolean;
    errorCount: number;
    interval: number;
  };
  offlineMode: boolean;
  toggleOfflineMode: () => void;
}

const PowerSyncAppContext = createContext<PowerSyncAppContextType>({
  isConnected: false,
  lastSyncAttempt: null,
  syncStatus: {
    initialized: false,
    connected: false,
    errorCount: 0,
    interval: 5000,
  },
  offlineMode: false,
  toggleOfflineMode: () => {},
});

// Get the PowerSync URL from environment
const POWERSYNC_URL =
  process.env.EXPO_PUBLIC_POWERSYNC_URL ||
  "https://your-powersync-instance.powersync.com";

export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth(); // Get auth state from our AuthContext
  
  const [isConnected, setIsConnected] = useState(false); // Start with not connected until confirmed
  const [isInitialized, setIsInitialized] = useState(false); // Track initialization status
  const [offlineMode, setOfflineMode] = useState(false); // State for offline mode
  const offlineModeRef = useRef<boolean>(false); // Additional ref to track offline mode for closures
  const connectorRef = useRef<SupabaseConnector | null>(null);
  const uploadIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null); // Track current user ID for resets
  
  // Update the ref whenever offlineMode state changes
  useEffect(() => {
    offlineModeRef.current = offlineMode;
    
    // Update connector whenever offline mode changes
    if (connectorRef.current) {
      connectorRef.current.setOfflineMode(offlineMode);
      console.log(`📱 PowerSync provider offline mode updated to: ${offlineMode}`);
    }
  }, [offlineMode]);

  // Function to upload pending changes
  // Keep track of consecutive errors and adjust sync interval
  const [syncErrorCount, setSyncErrorCount] = useState(0);
  const [syncInterval, setSyncInterval] = useState(5000); // Start with 5 seconds
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null); // Track last sync attempt

  const uploadPendingChanges = async () => {
    if (!connectorRef.current) {
      console.log("⚠️ No connector available");
      return;
    }

    // Always use the ref value for most up-to-date state in async functions
    const currentOfflineMode = offlineModeRef.current;

    // Double-check offline mode in connector too
    if (connectorRef.current.isOfflineMode()) {
      if (!currentOfflineMode) {
        console.log('⚠️ State inconsistency: Provider online but connector offline - fixing...');
        connectorRef.current.setOfflineMode(false);
      } else {
        console.log("📴 Offline mode enabled - skipping sync");
        // Still schedule the next check, even in offline mode
        uploadIntervalRef.current = setTimeout(uploadPendingChanges, syncInterval);
        return;
      }
    } else if (currentOfflineMode) {
      console.log('⚠️ State inconsistency: Provider offline but connector online - fixing...');
      connectorRef.current.setOfflineMode(true);
      uploadIntervalRef.current = setTimeout(uploadPendingChanges, syncInterval);
      return;
    }
    
    console.log('📱 Online mode - attempting sync');

    // Track sync attempt time
    const attemptTime = new Date();
    setLastSyncAttempt(attemptTime);

    console.log(
      `🔄 Attempting to upload changes to Supabase at ${attemptTime.toISOString()}...`
    );
    try {
      // Test Supabase connection before trying to sync
      const { data, error } = await supabase
        .from("tasks")
        .select("count")
        .limit(1);
      if (error) {
        throw new Error(`Supabase connection check failed: ${error.message}`);
      }

      setIsConnected(true); // Connection is good

      // If connection is good, proceed with sync
      await connectorRef.current.uploadData(powersync);
      console.log("✅ Sync completed successfully");

      // Reset error count and interval on success
      if (syncErrorCount > 0) {
        setSyncErrorCount(0);
        setSyncInterval(5000); // Reset to 5 seconds
      }
    } catch (error) {
      console.error("❌ Error during sync:", error);

      // Increment error count and implement exponential backoff
      const newErrorCount = syncErrorCount + 1;
      setSyncErrorCount(newErrorCount);

      // Calculate new interval with exponential backoff (max 60 seconds)
      const newInterval = Math.min(5000 * Math.pow(1.5, newErrorCount), 60000);
      setSyncInterval(newInterval);

      console.log(
        `⚠️ Sync error #${newErrorCount}. Next attempt in ${
          newInterval / 1000
        } seconds`
      );
    }

    // Schedule next upload with dynamic interval
    uploadIntervalRef.current = setTimeout(uploadPendingChanges, syncInterval);
  };

  // Track authentication state changes
  useEffect(() => {
    // Update the user ID ref when auth state changes
    userIdRef.current = user?.id || null;
    
    // When user signs in or out, we need to reinitialize PowerSync
    if (user) {
      console.log(`👤 User authenticated: ${user.id}`); 
      // Force reconnect when user signs in
      if (connectorRef.current) {
        // Restart sync process
        if (uploadIntervalRef.current) {
          clearTimeout(uploadIntervalRef.current);
        }
        uploadPendingChanges();
      }
    } else {
      console.log('👤 No authenticated user');
    }
  }, [user, session]);

  // Initialize PowerSync and set up data synchronization
  useEffect(() => {
    const initializePowerSync = async () => {
      try {
        // Initialize the connector
        const connector = new SupabaseConnector(POWERSYNC_URL);
        connector.setOfflineMode(offlineMode); // Set initial offline mode
        connectorRef.current = connector;
        console.log(
          "💻 PowerSync connector initialized with URL:",
          POWERSYNC_URL
        );

        // Log Supabase configuration for debugging
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        console.log("💻 Supabase URL config:", supabaseUrl ? "Set" : "Missing");

        // Get credentials but don't try to connect directly - PowerSync will use the connector
        // We just needed to initialize the connector and store it in the ref
        console.log("✅ PowerSync connector ready to use");

        setIsInitialized(true);
        setIsConnected(true);
      } catch (error) {
        console.error("❌ PowerSync initialization error:", error);
        setIsConnected(false);
      }
    };

    initializePowerSync();

    // Test Supabase connection on startup
    const testSupabaseConnection = async () => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("count")
          .limit(1);
        if (error) {
          console.error("❌ Supabase connection test failed:", error.message);
        } else {
          console.log("✅ Supabase connection test successful!");
        }
      } catch (error) {
        console.error("❌ Supabase connection test error:", error);
      }
    };

    testSupabaseConnection();

    // Handler for auth state changes
    const handleAuthStateChange = async (event: string, session: any) => {
      if (event === "SIGNED_IN" && session) {
        console.log("✅ User signed in - continuing sync");
        setIsConnected(true);
      } else if (event === "SIGNED_OUT") {
        console.log("⚠️ User signed out - maintaining local data");
        // We no longer clear data on sign out to maintain offline tasks
      }
    };

    // Set up Supabase auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthStateChange);

    // Initial setup - start syncing with delay
    console.log("🔄 Starting PowerSync data synchronization");

    // Start sync attempt with a 5-second delay to allow app to initialize fully
    const syncTimer = setTimeout(uploadPendingChanges, 5000);

    // Return cleanup function
    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      subscription.unsubscribe();

      if (uploadIntervalRef.current) {
        clearTimeout(uploadIntervalRef.current);
      }
    };
  }, []);

    // Function to toggle offline mode
  const toggleOfflineMode = () => {
    const newOfflineMode = !offlineMode;
    
    // First update our ref for immediate consistency
    offlineModeRef.current = newOfflineMode;
    
    // Then update state for UI rendering
    setOfflineMode(newOfflineMode);
    
    // Force update the connector with new offline mode setting
    if (connectorRef.current) {
      connectorRef.current.setOfflineMode(newOfflineMode);
      console.log(`📱 Offline mode toggled to: ${newOfflineMode ? 'enabled' : 'disabled'}`);
    }
    
    // If turning offline mode off, force immediate sync
    if (!newOfflineMode) {
      // Clear any existing timer
      if (uploadIntervalRef.current) {
        clearTimeout(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      
      // Force immediate sync with enough delay to ensure state updates propagate
      console.log('🔄 Will force sync after offline->online transition');
      
      // Use a slightly longer timeout to ensure all state changes propagate
      setTimeout(() => {
        console.log('🔄 Now forcing sync after state propagation delay');
        if (connectorRef.current) {
          // Double check and force connector to online mode
          connectorRef.current.setOfflineMode(false);
        }
        uploadPendingChanges();
      }, 500);
    }
  };

  return (
    <PowerSyncAppContext.Provider
      value={{
        isConnected,
        lastSyncAttempt: lastSyncAttempt?.toISOString() || null,
        syncStatus: {
          initialized: isInitialized,
          connected: isConnected,
          errorCount: syncErrorCount,
          interval: syncInterval,
        },
        offlineMode,
        toggleOfflineMode,
      }}
    >
      {children}
    </PowerSyncAppContext.Provider>
  );
}

// Custom hook to access PowerSync app context
export function usePowerSyncApp() {
  return useContext(PowerSyncAppContext);
}

// Export the database instance for direct access
export { powersync };
