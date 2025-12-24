import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = neon(process.env.DATABASE_URL);
  const migrationFile = join(process.cwd(), "drizzle", "0002_fast_carnage.sql");
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
        // Ignore "already exists" or "does not exist" errors
        if (error.message?.includes("already exists") || 
            error.message?.includes("duplicate") ||
            error.message?.includes("does not exist")) {
          console.log(`⚠ Statement ${i + 1} skipped (${error.message})`);
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

