import { relations, type InferSelectModel } from 'drizzle-orm';
import { pgTable, varchar, timestamp, json, uuid, text, primaryKey, foreignKey, boolean, integer, real, decimal, index, jsonb, } from 'drizzle-orm/pg-core';

export const user = pgTable('User', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  role: text('role').default('user'), // Ensure this exists
  email: varchar('email', { length: 64 }).notNull(),
  password: varchar('password', { length: 64 }),
  passwordPlainText: varchar('passwordPlainText', { length: 64 }),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  usedCode: text('usedCode'), // Stores the last successful code
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable('Chat', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  createdAt: timestamp('createdAt').notNull(),
  title: text('title'),
  userId: uuid('userId').notNull().references(() => user.id),
  visibility: varchar('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  capability: text('capability'), // Free-text, e.g., "copywriting"
  threadId: varchar('threadId', { length: 64 }), // Nullable
  deletedAt: timestamp('deletedAt'), // Nullable
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable('Message', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId').notNull().references(() => chat.id),
  role: varchar('role').notNull(),
  content: json('content').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  annotations: json('annotations').default(null),
  model: varchar('model', { length: 64 }).default('gpt-4o-mini'),
  promptTokens: integer('promptTokens'), // Nullable
  completionTokens: integer('completionTokens'), // Nullable
  totalTokens: integer('totalTokens'), // Nullable
  duration: decimal('duration'), // Nullable float-like
});

export type Message = InferSelectModel<typeof message>;

export const vote = pgTable(
  'Vote',
  {
    chatId: uuid('chatId').notNull().references(() => chat.id),
    messageId: uuid('messageId').notNull().references(() => message.id),
    isUpvoted: boolean('isUpvoted').notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  },
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  'Document',
  {
    id: uuid('id').notNull().defaultRandom(),
    createdAt: timestamp('createdAt').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    kind: varchar('text', { enum: ['text', 'code', 'image', 'sheet'] }).notNull().default('text'),
    userId: uuid('userId').notNull().references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  },
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  'Suggestion',
  {
    id: uuid('id').notNull().defaultRandom(),
    documentId: uuid('documentId').notNull(),
    documentCreatedAt: timestamp('documentCreatedAt').notNull(),
    originalText: text('originalText').notNull(),
    suggestedText: text('suggestedText').notNull(),
    description: text('description'),
    isResolved: boolean('isResolved').notNull().default(false),
    userId: uuid('userId').notNull().references(() => user.id),
    createdAt: timestamp('createdAt').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
      name: 'suggestion_document_fk',
    }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;


/*
|--------------------------------------------------------------------------
| Tracking
|--------------------------------------------------------------------------
*/
export const openAiApiUsage = pgTable('OpenAiApiUsage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  chatId: uuid('chatId').references(() => chat.id, { onDelete: 'cascade' }), // Add cascade,
  model: varchar('model', { length: 64 }).notNull(),
  type: varchar('type', { length: 64 }).notNull(),
  promptTokens: integer('promptTokens').notNull(),
  completionTokens: integer('completionTokens').notNull(),
  totalTokens: integer('totalTokens').notNull(),
  duration: decimal('duration'),
  completedAt: timestamp('completedAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type OpenAiApiUsage = InferSelectModel<typeof openAiApiUsage>;


/*
|--------------------------------------------------------------------------
| Subscription plans
|--------------------------------------------------------------------------
*/
export const subscriptionPlan = pgTable('SubscriptionPlan', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull(), // e.g., "Copywriting", "Calendar"
  capabilities: text('capabilities').notNull(), // Free-text, e.g., "copywriting" or "copywriting,calendar"
  createdAt: timestamp('createdAt').notNull().defaultNow(),
});

export type SubscriptionPlan = InferSelectModel<typeof subscriptionPlan>;

export const userSubscription = pgTable(
  'UserSubscription',
  {
    userId: uuid('userId').notNull().references(() => user.id, { onDelete: 'cascade' }), // Explicitly define behavior
    subscriptionPlanId: uuid('subscriptionPlanId').notNull().references(() => subscriptionPlan.id, { onDelete: 'cascade' }),
    subscribedAt: timestamp('subscribedAt').notNull().defaultNow(),
    isActive: boolean('isActive').notNull().default(true),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.subscriptionPlanId] }),
  }),
);

export type UserSubscription = InferSelectModel<typeof userSubscription>;

export const aiModel = pgTable('AIModel', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull(), // e.g., "Copywriting AI"
  endpoint: varchar('endpoint', { length: 256 }),
  apiKey: varchar('apiKey', { length: 128 }),
  capability: text('capability'), // Free-text, e.g., "copywriting"
  createdAt: timestamp('createdAt').notNull().defaultNow(),

  provider: varchar('provider', { length: 64 }).notNull().default('openai'),
  displayName: varchar('displayName', { length: 64 }),
  type: varchar('type', { length: 64 }),
  isActive: boolean('isActive').notNull().default(true),
  maxTokens: integer('maxTokens'), // Nullable
  temperature: integer('temperature'), // Nullable

  customPrompts: text('customPrompts'), // Nullable

  inputPrice: decimal('inputPrice', { precision: 10, scale: 4 }),
  outputPrice: decimal('outputPrice', { precision: 10, scale: 4 }),
  cachedInputPrice: decimal('cachedInputPrice', { precision: 10, scale: 4 }),
});

export type AIModel = InferSelectModel<typeof aiModel>;

export const subscriptionModel = pgTable(
  'SubscriptionModel',
  {
    subscriptionPlanId: uuid('subscriptionPlanId').notNull().references(() => subscriptionPlan.id),
    aiModelId: uuid('aiModelId').notNull().references(() => aiModel.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.subscriptionPlanId, table.aiModelId] }),
  }),
);

export type SubscriptionModel = InferSelectModel<typeof subscriptionModel>;


/*
|--------------------------------------------------------------------------
| Code to unlock with
|--------------------------------------------------------------------------
*/
// New table for valid unlock codes
export const codes = pgTable('Codes', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  code: text('code').notNull().unique(), // The unlock code (e.g., "SECRET123")
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  maxUses: integer('maxUses'), // Optional: max allowed uses (null = unlimited)
  isActive: boolean('isActive').notNull().default(true), // Can deactivate codes
});
// New table to track code usage
export const codeUsage = pgTable('CodeUsage', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('userId').notNull().references(() => user.id),
  codeId: uuid('codeId').notNull().references(() => codes.id),
  usedAt: timestamp('usedAt').notNull().defaultNow(),
  isSuccess: boolean('isSuccess').notNull(), // True if code was valid, false if invalid
});
// Relations (for joining queries)
export const userRelations = relations(user, ({ many }) => ({
  codeUsages: many(codeUsage),
  chats: many(chat),
}));
export const codesRelations = relations(codes, ({ many }) => ({
  codeUsages: many(codeUsage),
}));
export const codeUsageRelations = relations(codeUsage, ({ one }) => ({
  user: one(user, {
    fields: [codeUsage.userId],
    references: [user.id],
  }),
  code: one(codes, {
    fields: [codeUsage.codeId],
    references: [codes.id],
  }),
}));
// Type definitions
export type Code = InferSelectModel<typeof codes>;
export type CodeUsage = InferSelectModel<typeof codeUsage>;


/*
|--------------------------------------------------------------------------
| ai models
|--------------------------------------------------------------------------
*/
export const promptHistory = pgTable('PromptHistory', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  modelId: uuid('modelId').notNull().references(() => aiModel.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  userEmail: varchar('userEmail', { length: 128 }), // Optional, if you want to track users
});
export type PromptHistory = InferSelectModel<typeof promptHistory>;

/*
|--------------------------------------------------------------------------
| Scripts
|--------------------------------------------------------------------------
*/
// Single content table for scripts, voice-overs, creation, and done stages
export const content = pgTable('Content', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  userId: uuid('user_id').references(() => user.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  userPrompt: text('userPrompt').notNull(),
  topicPrompt: text('topicPrompt'), // Added: nullable text column for topicPrompt
  content_idea: varchar('content_idea'),
  hook_type: varchar('hook_type'),
  mood: varchar('mood').notNull(),
  generatedScript: text('generatedScript').notNull(),
  stage: varchar('stage', { length: 50 }).notNull().default('script'), // script, voice_over, creation, done
  scheduledDate: timestamp('scheduledDate'),
  deadline: timestamp('deadline'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
},
  (table) => ({
    calendarIdx: index('idx_content_stage_scheduledDate').on(table.stage, table.scheduledDate),
    deadlineIdx: index('idx_content_stage_deadline').on(table.stage, table.deadline), // Optional
  })
);
export const scriptHistory = pgTable(
  'ScriptHistory',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    userId: uuid('user_id').references(() => user.id).notNull(),
    contentId: uuid('content_id').references(() => content.id), // Nullable, as history might not always tie to a Content record
    userPrompt: text('user_prompt').notNull(),
    topicPrompt: text('topic_prompt'), // Nullable, as in your Content table
    contentIdea: varchar('content_idea', { length: 255 }).notNull(),
    hookType: varchar('hook_type', { length: 255 }).notNull(),
    generatedScripts: jsonb('generated_scripts').notNull(), // Store the array of scripts as JSONB
    usedModelId: varchar('used_model_id', { length: 255 }), // Store the AI model ID used
    tokenUsage: jsonb('token_usage'), // Store token usage details (prompt_tokens, completion_tokens, total_tokens)
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('idx_script_history_user_id').on(table.userId),
    createdAtIdx: index('idx_script_history_created_at').on(table.createdAt),
  })
);
export const generatedSplitHistory = pgTable('GeneratedSplitHistory', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => user.id).notNull(),
  prompt: text('prompt').notNull(),
  clientPersona: text('client_persona').notNull(),
  contentPillar: text('content_pillar').notNull(),
  subPillars: jsonb('sub_pillars').notNull().default([]),
  chosenSubPillars: jsonb('chosen_sub_pillars').notNull().default([]),
  hookType: jsonb('hook_type').notNull().default([]),
  scripts: jsonb('scripts').notNull().default([]),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  isDeleted: boolean('is_deleted').notNull().default(false),
});

export const splitPromptHistory = pgTable('SplitPromptHistory', {
  id: uuid('id').primaryKey().notNull().defaultRandom(),
  modelId: uuid('modelId').references(() => aiModel.id, { onDelete: 'cascade' }), // Removed notNull() to make it nullable
  modelCodeName: varchar('modelCodeName', { length: 128 }), // Added new column
  prompt: text('prompt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  userEmail: varchar('userEmail', { length: 128 }), // Optional, for user tracking
  isCurrent: boolean('isCurrent').notNull().default(false), // Flag to mark the current prompt
});
