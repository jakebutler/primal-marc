import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running database migrations...");

  try {
    // Create enums
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE blog_type AS ENUM ('academic', 'argumentative', 'lessons', 'metaphor', 'systems');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE blog_status AS ENUM ('draft', 'voice_tone_pending', 'thesis_pending', 'research_pending', 'draft_pending', 'editorial_pending', 'final_pending', 'completed', 'archived');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE step_name AS ENUM ('voice_tone', 'thesis', 'research', 'draft', 'editorial');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE provider AS ENUM ('openai', 'anthropic', 'perplexity', 'exa');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log("Enums created successfully");
    console.log("Please run 'npm run db:generate' and 'npm run db:migrate' to create tables");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

migrate()
  .then(() => {
    console.log("Migration completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });

