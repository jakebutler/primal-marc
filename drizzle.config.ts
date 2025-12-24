export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql" as const,
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};

