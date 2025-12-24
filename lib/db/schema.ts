import { pgTable, uuid, varchar, text, jsonb, timestamp, integer, boolean, pgEnum, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const blogTypeEnum = pgEnum("blog_type", [
  "academic",
  "argumentative",
  "lessons",
  "metaphor",
  "systems",
]);

export const blogStatusEnum = pgEnum("blog_status", [
  "draft",
  "voice_tone_pending",
  "thesis_pending",
  "research_pending",
  "draft_pending",
  "editorial_pending",
  "final_pending",
  "completed",
  "archived",
]);

export const stepNameEnum = pgEnum("step_name", [
  "voice_tone",
  "thesis",
  "research",
  "draft",
  "editorial",
]);

export const providerEnum = pgEnum("provider", [
  "openai",
  "anthropic",
  "perplexity",
  "exa",
]);

// Tables
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  clerkUserIdIdx: index("idx_users_clerk_user_id").on(table.clerkUserId),
  emailIdx: index("idx_users_email").on(table.email),
}));

export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  idea: text("idea"), // Store the initial idea
  title: varchar("title", { length: 500 }),
  blogType: blogTypeEnum("blog_type").notNull(),
  status: blogStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_blog_posts_user_id").on(table.userId),
  statusIdx: index("idx_blog_posts_status").on(table.status),
  blogTypeIdx: index("idx_blog_posts_blog_type").on(table.blogType),
  createdAtIdx: index("idx_blog_posts_created_at").on(table.createdAt),
}));

export const blogPostStates = pgTable("blog_post_states", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  stepName: stepNameEnum("step_name").notNull(),
  stateData: jsonb("state_data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blogPostIdIdx: index("idx_blog_post_states_blog_post_id").on(table.blogPostId),
  stepNameIdx: index("idx_blog_post_states_step_name").on(table.stepName),
  createdAtIdx: index("idx_blog_post_states_created_at").on(table.createdAt),
}));

export const voiceToneSelections = pgTable("voice_tone_selections", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  selectedOptionId: varchar("selected_option_id", { length: 255 }).notNull(),
  selectedOptionName: varchar("selected_option_name", { length: 255 }).notNull(),
  styleGuidelines: jsonb("style_guidelines").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blogPostIdIdx: index("idx_voice_tone_selections_blog_post_id").on(table.blogPostId),
  blogPostIdUnique: unique("voice_tone_selections_blog_post_id_unique").on(table.blogPostId),
}));

export const thesisOutlines = pgTable("thesis_outlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  thesisStatement: text("thesis_statement").notNull(),
  outline: jsonb("outline").notNull(),
  evidenceExpectations: jsonb("evidence_expectations"), // Store evidence expectations for research
  conclusionIntent: text("conclusion_intent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blogPostIdIdx: index("idx_thesis_outlines_blog_post_id").on(table.blogPostId),
  blogPostIdUnique: unique("thesis_outlines_blog_post_id_unique").on(table.blogPostId),
}));

export const researchSources = pgTable("research_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  sources: jsonb("sources").notNull(),
  sectionMapping: jsonb("section_mapping").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blogPostIdIdx: index("idx_research_sources_blog_post_id").on(table.blogPostId),
  blogPostIdUnique: unique("research_sources_blog_post_id_unique").on(table.blogPostId),
}));

export const blogDrafts = pgTable("blog_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  wordCount: integer("word_count").notNull(),
  version: integer("version").notNull().default(1), // Track draft versions
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blogPostIdIdx: index("idx_blog_drafts_blog_post_id").on(table.blogPostId),
}));

export const finalPosts = pgTable("final_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  blogPostId: uuid("blog_post_id").notNull().references(() => blogPosts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  seoMetadata: jsonb("seo_metadata").notNull(),
  socialPosts: jsonb("social_posts").notNull(),
  citations: jsonb("citations").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  blogPostIdIdx: index("idx_final_posts_blog_post_id").on(table.blogPostId),
  blogPostIdUnique: unique("final_posts_blog_post_id_unique").on(table.blogPostId),
}));

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  blogType: blogTypeEnum("blog_type").notNull(),
  voiceTone: jsonb("voice_tone"),
  savedState: jsonb("saved_state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_templates_user_id").on(table.userId),
  blogTypeIdx: index("idx_templates_blog_type").on(table.blogType),
}));

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: providerEnum("provider").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  lastUsed: timestamp("last_used", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdProviderIdx: unique("api_keys_user_provider_unique").on(table.userId, table.provider),
  userIdIdx: index("idx_api_keys_user_id").on(table.userId),
  providerIdx: index("idx_api_keys_provider").on(table.provider),
}));

export const accessRequests = pgTable("access_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, approved, rejected
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: index("idx_access_requests_email").on(table.email),
  statusIdx: index("idx_access_requests_status").on(table.status),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  blogPosts: many(blogPosts),
  templates: many(templates),
  apiKeys: many(apiKeys),
}));

export const blogPostsRelations = relations(blogPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [blogPosts.userId],
    references: [users.id],
  }),
  states: many(blogPostStates),
  voiceToneSelection: one(voiceToneSelections),
  thesisOutline: one(thesisOutlines),
  researchSources: one(researchSources),
  draft: one(blogDrafts),
  finalPost: one(finalPosts),
}));

