import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])
export const goalTypeEnum = pgEnum('goal_type', ['one_time', 'recurring', 'project'])
export const recurrenceTypeEnum = pgEnum('recurrence_type', ['daily', 'weekly_days', 'weekly_count'])
export const occurrenceStatusEnum = pgEnum('occurrence_status', [
  'pending',
  'completed',
  'failed',
  'skipped',
])
export const validationStatusEnum = pgEnum('validation_status', [
  'pending_review',
  'approved',
  'rejected',
])
export const creditEntryTypeEnum = pgEnum('credit_entry_type', [
  'task_reward',
  'task_penalty',
  'debt_created',
  'debt_repayment',
  'admin_adjustment',
  'signup_bonus',
  'streak_bonus',
  'leaderboard_reward',
  'transfer_received',
  'transfer_sent',
])

export const dailyResultStatusEnum = pgEnum('daily_result_status', [
  'neutral',
  'success',
  'failed',
])
export const proofTypeEnum = pgEnum('proof_type', ['text', 'url', 'image'])

export const consequenceHistoryStatusEnum = pgEnum('consequence_history_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  displayName: text('display_name').notNull(),
  role: userRoleEnum('role').notNull().default('user'),
  timezone: text('timezone').notNull().default('Europe/Paris'),
  isBlocked: boolean('is_blocked').notNull().default(false),
  leaderboardOptIn: boolean('leaderboard_opt_in').notNull().default(true),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripePaymentMethodId: text('stripe_payment_method_id'),
  stripePaymentMethodBrand: text('stripe_payment_method_brand'),
  stripePaymentMethodLast4: text('stripe_payment_method_last4'),
  stripePaymentMethodExpMonth: integer('stripe_payment_method_exp_month'),
  stripePaymentMethodExpYear: integer('stripe_payment_method_exp_year'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('users_email_idx').on(table.email),
  index('users_role_idx').on(table.role),
])

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('sessions_token_idx').on(table.token),
  index('sessions_user_id_idx').on(table.userId),
])

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const wallets = pgTable('wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  balance: integer('balance').notNull().default(0),
  debt: integer('debt').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const creditLedger = pgTable('credit_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: creditEntryTypeEnum('type').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  debtAfter: integer('debt_after').notNull(),
  occurrenceId: uuid('occurrence_id'),
  goalId: uuid('goal_id'),
  adminId: uuid('admin_id'),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('credit_ledger_user_id_idx').on(table.userId),
  index('credit_ledger_created_at_idx').on(table.createdAt),
])

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  type: goalTypeEnum('type').notNull(),
  category: text('category'),
  recurrenceType: recurrenceTypeEnum('recurrence_type'),
  recurrenceConfig: jsonb('recurrence_config').$type<{
    daysOfWeek?: number[]
    timesPerWeek?: number
    dueTime?: string
  }>(),
  dueDate: date('due_date'),
  rewardCredits: integer('reward_credits').notNull().default(10),
  penaltyCredits: integer('penalty_credits').notNull().default(20),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('goals_user_id_idx').on(table.userId),
  index('goals_type_idx').on(table.type),
])

export const projectMilestones = pgTable('project_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  orderIndex: integer('order_index').notNull().default(0),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('project_milestones_goal_id_idx').on(table.goalId),
])

export const occurrences = pgTable('occurrences', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  milestoneId: uuid('milestone_id').references(() => projectMilestones.id, { onDelete: 'set null' }),
  dueDate: date('due_date').notNull(),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  status: occurrenceStatusEnum('status').notNull().default('pending'),
  weekKey: text('week_key'),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('occurrences_user_id_idx').on(table.userId),
  index('occurrences_goal_id_idx').on(table.goalId),
  index('occurrences_status_idx').on(table.status),
  index('occurrences_due_at_idx').on(table.dueAt),
  uniqueIndex('occurrences_goal_due_unique').on(table.goalId, table.dueDate, table.milestoneId),
])

export const validations = pgTable('validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  occurrenceId: uuid('occurrence_id').notNull().references(() => occurrences.id, { onDelete: 'cascade' }).unique(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: validationStatusEnum('status').notNull().default('pending_review'),
  note: text('note'),
  proofType: proofTypeEnum('proof_type'),
  proofContent: text('proof_content'),
  proofUrl: text('proof_url'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('validations_status_idx').on(table.status),
  index('validations_user_id_idx').on(table.userId),
])

export const userDailyResults = pgTable('user_daily_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dateKey: date('date_key').notNull(),
  status: dailyResultStatusEnum('status').notNull(),
  totalOccurrences: integer('total_occurrences').notNull().default(0),
  completedOccurrences: integer('completed_occurrences').notNull().default(0),
  failedOccurrences: integer('failed_occurrences').notNull().default(0),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('user_daily_results_user_date_unique').on(table.userId, table.dateKey),
  index('user_daily_results_date_key_idx').on(table.dateKey),
])

export const userStreaks = pgTable('user_streaks', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastSuccessDate: date('last_success_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const streakRewards = pgTable('streak_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  milestone: integer('milestone').notNull(),
  amount: integer('amount').notNull(),
  creditLedgerId: uuid('credit_ledger_id').references(() => creditLedger.id),
  awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('streak_rewards_user_milestone_unique').on(table.userId, table.milestone),
])

export const leaderboardDailySnapshots = pgTable('leaderboard_daily_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekKey: text('week_key').notNull(),
  snapshotDate: date('snapshot_date').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rank: integer('rank').notNull(),
  netScore: integer('net_score').notNull(),
  balance: integer('balance').notNull(),
  debt: integer('debt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('leaderboard_snapshots_date_user_unique').on(table.snapshotDate, table.userId),
  index('leaderboard_snapshots_week_key_idx').on(table.weekKey),
  index('leaderboard_snapshots_week_user_idx').on(table.weekKey, table.userId),
])

export const leaderboardWeeklyRewards = pgTable('leaderboard_weekly_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  weekKey: text('week_key').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  finalRank: integer('final_rank').notNull(),
  rewardAmount: integer('reward_amount').notNull(),
  daysQualified: integer('days_qualified').notNull(),
  creditLedgerId: uuid('credit_ledger_id').references(() => creditLedger.id),
  settledAt: timestamp('settled_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('leaderboard_weekly_rewards_week_user_unique').on(table.weekKey, table.userId),
])

export const consequenceTypes = pgTable('consequence_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const userConsequences = pgTable('user_consequences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  amount: integer('amount').notNull().default(0),
  priority: integer('priority').notNull().default(0),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('user_consequences_user_id_idx').on(table.userId),
  index('user_consequences_user_priority_idx').on(table.userId, table.priority),
  uniqueIndex('user_consequences_user_type_unique').on(table.userId, table.type),
])

export const consequenceHistory = pgTable('consequence_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userConsequenceId: uuid('user_consequence_id').notNull().references(() => userConsequences.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').notNull().references(() => occurrences.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  status: consequenceHistoryStatusEnum('status').notNull().default('pending'),
  amount: integer('amount').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  executedAt: timestamp('executed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('consequence_history_user_id_idx').on(table.userId),
  index('consequence_history_goal_id_idx').on(table.goalId),
  index('consequence_history_status_idx').on(table.status),
  uniqueIndex('consequence_history_occurrence_user_consequence_unique').on(table.occurrenceId, table.userConsequenceId),
])

export const communityPotTransactions = pgTable('community_pot_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  consequenceHistoryId: uuid('consequence_history_id').references(() => consequenceHistory.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('community_pot_transactions_user_id_idx').on(table.userId),
  index('community_pot_transactions_created_at_idx').on(table.createdAt),
])

export const communityPotSettings = pgTable('community_pot_settings', {
  id: text('id').primaryKey().default('default'),
  monthlyGoalCents: integer('monthly_goal_cents').notNull().default(50000),
  targetAssociation: text('target_association').notNull().default('msf'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const communityPotPayouts = pgTable('community_pot_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  period: text('period').notNull(),
  association: text('association').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('community_pot_payouts_period_idx').on(table.period),
])

export const associations = pgTable('associations', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  logoUrl: text('logo_url'),
  enabled: boolean('enabled').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('associations_enabled_sort_idx').on(table.enabled, table.sortOrder),
])

export const associationPotPayouts = pgTable('association_pot_payouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  associationSlug: text('association_slug').notNull().references(() => associations.slug, { onDelete: 'restrict' }),
  period: text('period').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('association_pot_payouts_slug_idx').on(table.associationSlug),
  index('association_pot_payouts_period_idx').on(table.period),
])

export const donationExecutions = pgTable('donation_executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  association: text('association').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  consequenceHistoryId: uuid('consequence_history_id').references(() => consequenceHistory.id, { onDelete: 'set null' }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeTransferId: text('stripe_transfer_id'),
  status: text('status').notNull().default('accumulated'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('donation_executions_user_id_idx').on(table.userId),
  index('donation_executions_association_idx').on(table.association),
  index('donation_executions_status_idx').on(table.status),
  uniqueIndex('donation_executions_history_unique').on(table.consequenceHistoryId),
])

export const proofRequirements = pgTable('proof_requirements', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  consequenceHistoryId: uuid('consequence_history_id').references(() => consequenceHistory.id, { onDelete: 'set null' }).unique(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('proof_requirements_user_goal_pending_idx').on(table.userId, table.goalId),
])

export const internalTransfers = pgTable('internal_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromUserId: uuid('from_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  toUserId: uuid('to_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  consequenceHistoryId: uuid('consequence_history_id').references(() => consequenceHistory.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('internal_transfers_from_user_id_idx').on(table.fromUserId),
  index('internal_transfers_to_user_id_idx').on(table.toUserId),
])

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('notifications_user_id_idx').on(table.userId),
  index('notifications_user_read_idx').on(table.userId, table.read),
])

export const stripePayments = pgTable('stripe_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  consequenceHistoryId: uuid('consequence_history_id').references(() => consequenceHistory.id, { onDelete: 'set null' }),
  paymentIntentId: text('payment_intent_id').notNull().unique(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  status: text('status').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('stripe_payments_user_id_idx').on(table.userId),
  index('stripe_payments_status_idx').on(table.status),
])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_logs_created_at_idx').on(table.createdAt),
  index('audit_logs_actor_id_idx').on(table.actorId),
])

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  wallet: one(wallets),
  goals: many(goals),
  occurrences: many(occurrences),
  creditEntries: many(creditLedger),
  streak: one(userStreaks),
  dailyResults: many(userDailyResults),
  consequences: many(userConsequences),
  notifications: many(notifications),
}))

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  milestones: many(projectMilestones),
  occurrences: many(occurrences),
}))

export const occurrencesRelations = relations(occurrences, ({ one }) => ({
  goal: one(goals, { fields: [occurrences.goalId], references: [goals.id] }),
  user: one(users, { fields: [occurrences.userId], references: [users.id] }),
  milestone: one(projectMilestones, { fields: [occurrences.milestoneId], references: [projectMilestones.id] }),
  validation: one(validations),
}))

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, { fields: [wallets.userId], references: [users.id] }),
}))

export type User = typeof users.$inferSelect
export type Goal = typeof goals.$inferSelect
export type Occurrence = typeof occurrences.$inferSelect
export type Validation = typeof validations.$inferSelect
export type Wallet = typeof wallets.$inferSelect
export type CreditLedgerEntry = typeof creditLedger.$inferSelect
export type ProjectMilestone = typeof projectMilestones.$inferSelect
export type UserDailyResult = typeof userDailyResults.$inferSelect
export type UserStreak = typeof userStreaks.$inferSelect
export type StreakReward = typeof streakRewards.$inferSelect
export type LeaderboardDailySnapshot = typeof leaderboardDailySnapshots.$inferSelect
export type LeaderboardWeeklyReward = typeof leaderboardWeeklyRewards.$inferSelect
export type ConsequenceType = typeof consequenceTypes.$inferSelect
export type UserConsequence = typeof userConsequences.$inferSelect
export type ConsequenceHistory = typeof consequenceHistory.$inferSelect
export type CommunityPotTransaction = typeof communityPotTransactions.$inferSelect
export type CommunityPotSettings = typeof communityPotSettings.$inferSelect
export type CommunityPotPayout = typeof communityPotPayouts.$inferSelect
export type Association = typeof associations.$inferSelect
export type AssociationPotPayout = typeof associationPotPayouts.$inferSelect
export type DonationExecution = typeof donationExecutions.$inferSelect
export type ProofRequirement = typeof proofRequirements.$inferSelect
export type InternalTransfer = typeof internalTransfers.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type StripePayment = typeof stripePayments.$inferSelect
