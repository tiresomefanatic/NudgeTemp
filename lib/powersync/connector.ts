import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/react-native";
import { supabase } from "../supabase/client";

export class SupabaseConnector implements PowerSyncBackendConnector {
  private powersyncUrl: string;
  private offlineMode: boolean = false;

  constructor(powersyncUrl: string) {
    this.powersyncUrl = powersyncUrl;
  }
  
  /**
   * Sets the connector to offline mode (prevents syncing with backend)
   * @param isOffline Whether to enable or disable offline mode
   */
  setOfflineMode(isOffline: boolean) {
    this.offlineMode = isOffline;
    console.log(`📱 PowerSync connector offline mode set to: ${isOffline}`);
    return this.offlineMode;
  }
  
  /**
   * Returns whether the connector is in offline mode
   * @returns The current offline mode status
   */
  isOfflineMode(): boolean {
    return this.offlineMode;
  }

  /**
   * Fetches credentials for PowerSync from Supabase
   * In a production app, your server would generate this JWT with proper claims
   */
  async fetchCredentials(): Promise<{ endpoint: string; token: string }> {
    // If offline mode is enabled, return immediately with development token
    if (this.offlineMode) {
      console.log("📴 Using offline mode for credentials");
      return {
        endpoint: this.powersyncUrl,
        token: "offline-mode-token",
      };
    }
    try {
      // Get the current session from Supabase
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        console.log("✅ Using authenticated session for PowerSync");
        console.log(`👤 User ID: ${session.user?.id}`);
        console.log(
          `🔐 Token expires: ${new Date(
            session.expires_at! * 1000
          ).toISOString()}`
        );

        // First validate token isn't expired
        const now = Math.floor(Date.now() / 1000);
        if (session.expires_at && session.expires_at < now) {
          console.warn("⚠️ Session token is expired, attempting refresh...");
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();

          if (refreshError) {
            throw new Error(`Session refresh failed: ${refreshError.message}`);
          }

          if (refreshData.session) {
            console.log("✅ Session refreshed successfully");
            return {
              endpoint: this.powersyncUrl,
              token: refreshData.session.access_token,
            };
          }
        }

        return {
          endpoint: this.powersyncUrl,
          token: session.access_token,
        };
      }
    } catch (error) {
      console.warn("⚠️ Error fetching Supabase session:", error);
    }

    // Fallback for development - use a placeholder token when not authenticated
    // This allows local operations to work without authentication
    console.log("⚠️ No Supabase session - using development fallback");
    console.log(
      "⚠️ Note: Some PowerSync operations may fail without proper authentication"
    );
    return {
      endpoint: this.powersyncUrl,
      token: "development-token",
    };
  }

  /**
   * Uploads local changes to Supabase
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    // If offline mode is enabled, skip uploading data
    if (this.offlineMode) {
      console.log("📴 Offline mode enabled - skipping data upload");
      return;
    }
    // Get the next transaction to process
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      console.log("✅ No pending transactions to process");
      return;
    }

    // Log the transaction details for debugging
    console.log(
      `🔄 Processing transaction with ${transaction.crud.length} operations:`,
      transaction.crud.map((op) => `${op.op} ${op.id}`).join(", ")
    );

    try {
      // Check if the tasks table exists in Supabase
      const { error: tableCheckError } = await supabase
        .from("tasks")
        .select("id")
        .limit(1);

      // If we can't access the tasks table, complete the transaction and log the error
      if (tableCheckError) {
        console.error(
          `❌ Error accessing tasks table: ${tableCheckError.message}`
        );
        console.warn("⚠️ Skipping transaction due to table access error");
        await transaction.complete();
        return;
      }

      console.log(`🔄 Processing ${transaction.crud.length} operations`);

      // Keep track of tasks that have been completed in Supabase
      const completedTasksCache = new Set<string>();
      
      // First check if any of the operations involve completed tasks
      for (const op of transaction.crud) {
        if (op.op === UpdateType.PUT || op.op === UpdateType.PATCH) {
          const record = { ...op.opData } as any;
          
          // Skip unnecessary re-syncing of already completed tasks
          if (record.is_completed === 1 || record.is_completed === true) {
            try {
              // Check if the task is already completed in Supabase
              const { data, error } = await supabase
                .from("tasks")
                .select("is_completed")
                .eq("id", op.id)
                .single();
                
              if (!error && data && (data.is_completed === 1 || data.is_completed === true)) {
                // Task is already completed in Supabase, add to cache
                completedTasksCache.add(op.id);
                console.log(`⏭️ Task ${op.id} is already completed in Supabase, skipping resync`);
              }
            } catch (error) {
              console.log(`Error checking completion state for ${op.id}:`, error);
            }
          }
        }
      }

      // Process all operations in the transaction
      for (const op of transaction.crud) {
        try {
          // Skip if this is a completed task we've already verified in Supabase
          if (completedTasksCache.has(op.id)) {
            console.log(`⏭️ Skipping resync of completed task: ${op.id}`);
            continue;
          }

          // The data that needs to be changed in Supabase
          const record = { ...op.opData, id: op.id } as any; // Use any to allow property access

          // Log the exact record being sent to Supabase
          console.log(
            `📤 Sending to Supabase (${op.op}):`,
            JSON.stringify(record)
          );

          let result;

          switch (op.op) {
            case UpdateType.PUT:
              // Create a new record in Supabase
              console.log(`📝 Creating task in Supabase: ${op.id}`);
              
              // Make sure is_completed and is_postponed are properly formatted as 1/0 integers
              // This is important because Supabase stores them as integers but sometimes receives booleans
              if (record.is_completed !== undefined) {
                record.is_completed = record.is_completed === true ? 1 : (record.is_completed === false ? 0 : record.is_completed);
              }
              if (record.is_postponed !== undefined) {
                record.is_postponed = record.is_postponed === true ? 1 : (record.is_postponed === false ? 0 : record.is_postponed);
              }
              
              result = await supabase.from("tasks").upsert(record);
              if (result.error) {
                console.error(
                  `❌ Insert error: ${result.error.message}`,
                  result.error
                );

                // Check for common errors
                if (
                  result.error.message.includes(
                    "violates foreign key constraint"
                  )
                ) {
                  console.warn(
                    "⚠️ Foreign key constraint error - check if user_id exists"
                  );
                } else if (result.error.message.includes("duplicate key")) {
                  // Try update instead of insert for duplicate key errors
                  console.log("⚠️ Duplicate key - trying update instead");
                  result = await supabase
                    .from("tasks")
                    .update(record)
                    .eq("id", op.id);
                  if (!result.error) {
                    console.log(
                      `✅ Task updated instead of inserted: ${op.id}`
                    );
                  } else {
                    console.error(
                      `❌ Update fallback error: ${result.error.message}`
                    );
                  }
                }
              } else {
                console.log(`✅ Task created in Supabase: ${op.id}`);
              }
              break;

            case UpdateType.PATCH:
              // Update an existing record in Supabase
              console.log(`🔄 Updating task in Supabase: ${op.id}`);
              
              // Make sure is_completed and is_postponed are properly formatted as 1/0 integers
              if (record.is_completed !== undefined) {
                record.is_completed = record.is_completed === true ? 1 : (record.is_completed === false ? 0 : record.is_completed);
              }
              if (record.is_postponed !== undefined) {
                record.is_postponed = record.is_postponed === true ? 1 : (record.is_postponed === false ? 0 : record.is_postponed);
              }
              
              result = await supabase
                .from("tasks")
                .update(record)
                .eq("id", op.id);
              if (result.error) {
                console.error(
                  `❌ Update error: ${result.error.message}`,
                  result.error
                );

                // If record doesn't exist, try inserting it
                if (
                  result.error.message.includes("no rows affected") ||
                  result.error.code === "PGRST116"
                ) {
                  console.log("⚠️ No rows affected - trying insert instead");
                  result = await supabase.from("tasks").insert(record);
                  if (!result.error) {
                    console.log(
                      `✅ Task inserted instead of updated: ${op.id}`
                    );
                  } else {
                    console.error(
                      `❌ Insert fallback error: ${result.error.message}`
                    );
                  }
                }
              } else {
                console.log(`✅ Task updated in Supabase: ${op.id}`);
              }
              break;

            case UpdateType.DELETE:
              // Delete a record from Supabase
              console.log(`🗑️ Deleting task from Supabase: ${op.id}`);
              result = await supabase.from("tasks").delete().eq("id", op.id);
              if (result.error) {
                console.error(
                  `❌ Delete error: ${result.error.message}`,
                  result.error
                );

                // If row not found, consider it a success (already deleted)
                if (result.error.message.includes("no rows affected")) {
                  console.log(
                    `⚠️ No rows affected during delete - task ${op.id} may already be deleted`
                  );
                }
              } else {
                console.log(`✅ Task deleted from Supabase: ${op.id}`);
              }
              break;
          }
        } catch (opError) {
          console.error(
            `❌ Error processing operation ${op.op} for ${op.id}:`,
            opError
          );
          // Continue with next operation instead of failing entire transaction
        }
      }

      // Always complete the transaction, even if some operations had errors
      await transaction.complete();
      console.log(`✅ Transaction completed successfully`);
    } catch (error) {
      // Log the error with more details
      console.error("❌ Unhandled error in uploadData:", error);

      // Always complete the transaction to avoid infinite loop
      try {
        await transaction.complete();
        console.log("✅ Transaction marked as complete despite errors");
      } catch (completeError) {
        console.error("❌ Failed to complete transaction:", completeError);
      }
    }
  }
}
