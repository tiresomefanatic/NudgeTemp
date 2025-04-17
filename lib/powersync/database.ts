import { PowerSyncDatabase } from "@powersync/react-native";
import { AppSchema } from "./schema";

// Create and export the PowerSync database instance
export const powersync = new PowerSyncDatabase({
  // Use the schema we defined
  schema: AppSchema,
  database: {
    // Filename for the SQLite database - only instantiate one instance per file
    dbFilename: "nudge_tasks.db",
  },
});
