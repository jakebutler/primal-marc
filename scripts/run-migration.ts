import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Try to load .env.local if it exists
try {
  const dotenv = require("dotenv");
  const envPath = join(process.cwd(), ".env.local");
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
} catch (e) {
  // dotenv not available, assume env vars are set another way
  console.log("Note: dotenv not available, using environment variables directly");
}

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = neon(process.env.DATABASE_URL);
  // Run the latest migration (0003_new_zuras.sql for access_requests table)
  const migrationFile = join(process.cwd(), "drizzle", "0003_new_zuras.sql");
  const migrationSQL = readFileSync(migrationFile, "utf-8");

  // Split by statement breakpoint and execute each statement
  const statements = migrationSQL
    .split("--> statement-breakpoint")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`Running ${statements.length} migration statements...`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    if (statement.trim()) {
      try {
        await sql(statement);
        console.log(`✓ Executed statement ${i + 1}/${statements.length}`);
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes("already exists") || error.message?.includes("duplicate")) {
          console.log(`⚠ Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`✗ Error in statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
  }

  console.log("Migration completed successfully!");
}

runMigration()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });


