import { addDays, format, subDays } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import { count, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../database/schema'
import { hashPassword } from './password'

type Db = PostgresJsDatabase<typeof schema>

const TIMEZONE = 'Europe/Paris'
const DEMO_PASSWORD = 'Demo1234!'

function dueAt(dateStr: string, time = '23:59') {
  const [hours, minutes] = time.split(':').map(Number)
  const local = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  return fromZonedTime(local, TIMEZONE)
}

function dateOffset(days: number) {
  return format(addDays(new Date(), days), 'yyyy-MM-dd')
}

export async function seedDemoData(db: Db, adminEmail: string, force = false) {
  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, adminEmail.toLowerCase()))
    .limit(1)

  if (!admin) {
    throw new Error(`Compte admin introuvable (${adminEmail}). Lancez d'abord l'app pour créer l'admin.`)
  }

  const [existingGoals] = await db
    .select({ count: count() })
    .from(schema.goals)
    .where(eq(schema.goals.userId, admin.id))

  if (existingGoals.count > 0 && !force) {
    return { skipped: true, reason: 'Données démo déjà présentes pour l\'admin' }
  }

  if (force && existingGoals.count > 0) {
    await clearUserDemoData(db, admin.id)
  }

  const [wallet] = await db.select().from(schema.wallets).where(eq(schema.wallets.userId, admin.id)).limit(1)
  if (!wallet) {
    await db.insert(schema.wallets).values({ userId: admin.id, balance: 0, debt: 0 })
  }

  await db.update(schema.users).set({
    onboardingCompleted: true,
    displayName: admin.displayName === 'Administrateur' ? 'Mickael' : admin.displayName,
    timezone: TIMEZONE,
    leaderboardOptIn: true,
  }).where(eq(schema.users.id, admin.id))

  const today = format(new Date(), 'yyyy-MM-dd')
  const passwordHash = await hashPassword(DEMO_PASSWORD)

  // --- Compte admin : objectifs variés ---
  const [goalTwitter] = await db.insert(schema.goals).values({
    userId: admin.id,
    title: 'Publier sur X',
    description: 'Un post par jour pour maintenir la présence en ligne.',
    type: 'recurring',
    category: 'Réseaux sociaux',
    recurrenceType: 'daily',
    recurrenceConfig: { dueTime: '20:00' },
  }).returning()

  const [goalSport] = await db.insert(schema.goals).values({
    userId: admin.id,
    title: 'Séance de sport',
    description: '3 séances par semaine minimum.',
    type: 'recurring',
    category: 'Santé',
    recurrenceType: 'weekly_count',
    recurrenceConfig: { timesPerWeek: 3, dueTime: '21:00' },
  }).returning()

  const [goalProject] = await db.insert(schema.goals).values({
    userId: admin.id,
    title: 'Lancer Focus v1',
    description: 'Développement et design de la première version publique.',
    type: 'project',
    category: 'Projet',
  }).returning()

  const milestones = await db.insert(schema.projectMilestones).values([
    { goalId: goalProject.id, title: 'Design system', orderIndex: 0, dueDate: dateOffset(-14) },
    { goalId: goalProject.id, title: 'MVP fonctionnel', orderIndex: 1, dueDate: dateOffset(7) },
    { goalId: goalProject.id, title: 'Déploiement Railway', orderIndex: 2, dueDate: dateOffset(21) },
  ]).returning()

  const [goalLecture] = await db.insert(schema.goals).values({
    userId: admin.id,
    title: 'Finir « Deep Work »',
    description: 'Lire le livre avant la fin du mois.',
    type: 'one_time',
    category: 'Lecture',
    dueDate: dateOffset(12),
    recurrenceConfig: { dueTime: '23:59' },
  }).returning()

  // Occurrences admin — passé, aujourd'hui, échecs
  const adminOccurrences = []

  for (let i = 7; i >= 1; i--) {
    const d = dateOffset(-i)
    adminOccurrences.push({
      goalId: goalTwitter.id,
      userId: admin.id,
      dueDate: d,
      dueAt: dueAt(d, '20:00'),
      status: 'completed' as const,
      processedAt: dueAt(d, '19:30'),
    })
  }

  adminOccurrences.push({
    goalId: goalTwitter.id,
    userId: admin.id,
    dueDate: today,
    dueAt: dueAt(today, '20:00'),
    status: 'pending' as const,
  })

  adminOccurrences.push({
    goalId: goalTwitter.id,
    userId: admin.id,
    dueDate: dateOffset(-3),
    dueAt: dueAt(dateOffset(-3), '20:00'),
    status: 'failed' as const,
    processedAt: dueAt(dateOffset(-3), '23:59'),
  })

  for (const day of [dateOffset(-5), dateOffset(-2), today]) {
    adminOccurrences.push({
      goalId: goalSport.id,
      userId: admin.id,
      dueDate: day,
      dueAt: dueAt(day, '21:00'),
      status: day === today ? 'pending' as const : 'completed' as const,
      processedAt: day === today ? undefined : dueAt(day, '20:00'),
      weekKey: format(subDays(new Date(day), 0), 'yyyy-ww'),
    })
  }

  const [occDesign] = await db.insert(schema.occurrences).values({
    goalId: goalProject.id,
    userId: admin.id,
    milestoneId: milestones[0].id,
    dueDate: milestones[0].dueDate!,
    dueAt: dueAt(milestones[0].dueDate!, '23:59'),
    status: 'completed',
    processedAt: dueAt(milestones[0].dueDate!, '18:00'),
  }).returning()

  await db.insert(schema.occurrences).values({
    goalId: goalProject.id,
    userId: admin.id,
    milestoneId: milestones[1].id,
    dueDate: milestones[1].dueDate!,
    dueAt: dueAt(milestones[1].dueDate!, '23:59'),
    status: 'pending',
  })

  const insertedOccurrences = await db.insert(schema.occurrences).values(adminOccurrences).returning()

  const completedOcc = insertedOccurrences.find(o => o.status === 'completed' && o.goalId === goalTwitter.id)
  const failedOcc = insertedOccurrences.find(o => o.status === 'failed')
  const pendingSport = insertedOccurrences.find(o => o.status === 'pending' && o.goalId === goalSport.id)

  if (completedOcc) {
    await db.insert(schema.validations).values({
      occurrenceId: completedOcc.id,
      userId: admin.id,
      status: 'approved',
      note: 'Post publié sur @focus_app',
      proofType: 'url',
      proofUrl: 'https://x.com/focus_app/status/demo',
      reviewedBy: admin.id,
      reviewedAt: completedOcc.processedAt!,
    })
  }

  if (pendingSport) {
    await db.insert(schema.validations).values({
      occurrenceId: pendingSport.id,
      userId: admin.id,
      status: 'pending_review',
      note: 'Séance HIIT 45 min',
      proofType: 'text',
      proofContent: 'Photo de la salle de sport envoyée.',
    })
  }

  await db.insert(schema.validations).values({
    occurrenceId: occDesign.id,
    userId: admin.id,
    status: 'approved',
    note: 'Design system Tailwind finalisé',
    proofType: 'text',
    proofContent: 'Composants UiButton, UiCard, AppLogo validés.',
    reviewedBy: admin.id,
    reviewedAt: occDesign.processedAt!,
  })

  // Portefeuille admin : 145 crédits, 5 dette
  await db.update(schema.wallets).set({
    balance: 145,
    debt: 5,
    updatedAt: new Date(),
  }).where(eq(schema.wallets.userId, admin.id))

  const ledgerEntries = [
    { type: 'signup_bonus' as const, amount: 50, balanceAfter: 50, debtAfter: 0, reason: 'Bonus de bienvenue' },
    { type: 'task_reward' as const, amount: 10, balanceAfter: 60, debtAfter: 0, goalId: goalTwitter.id, reason: 'Post X publié' },
    { type: 'task_reward' as const, amount: 10, balanceAfter: 70, debtAfter: 0, goalId: goalSport.id, reason: 'Séance sport' },
    { type: 'task_reward' as const, amount: 10, balanceAfter: 80, debtAfter: 0, goalId: goalProject.id, reason: 'Jalon design system' },
    { type: 'task_penalty' as const, amount: -20, balanceAfter: 60, debtAfter: 0, goalId: goalTwitter.id, reason: 'Post X manqué' },
    { type: 'task_reward' as const, amount: 10, balanceAfter: 70, debtAfter: 0, goalId: goalTwitter.id, reason: 'Post X publié' },
    { type: 'debt_created' as const, amount: 15, balanceAfter: 0, debtAfter: 15, goalId: goalTwitter.id, reason: 'Solde insuffisant' },
    { type: 'task_reward' as const, amount: 10, balanceAfter: 0, debtAfter: 5, goalId: goalSport.id, reason: 'Remboursement dette partiel' },
    { type: 'debt_repayment' as const, amount: 10, balanceAfter: 0, debtAfter: 5, reason: 'Remboursement automatique' },
    { type: 'task_reward' as const, amount: 10, balanceAfter: 10, debtAfter: 5, goalId: goalTwitter.id, reason: 'Post X publié' },
    { type: 'admin_adjustment' as const, amount: 135, balanceAfter: 145, debtAfter: 5, reason: 'Ajustement démo plateforme' },
  ]

  for (const entry of ledgerEntries) {
    await db.insert(schema.creditLedger).values({
      userId: admin.id,
      ...entry,
      createdAt: subDays(new Date(), Math.floor(Math.random() * 14)),
    })
  }

  // --- Utilisateurs factices pour le panel admin ---
  const demoUsers = [
    { email: 'sophie.martin@demo.focus', displayName: 'Sophie Martin', balance: 80, debt: 0 },
    { email: 'lucas.bernard@demo.focus', displayName: 'Lucas Bernard', balance: 35, debt: 25 },
    { email: 'emma.dubois@demo.focus', displayName: 'Emma Dubois', balance: 120, debt: 0 },
  ]

  for (const demo of demoUsers) {
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, demo.email)).limit(1)
    if (existing) continue

    const [user] = await db.insert(schema.users).values({
      email: demo.email,
      passwordHash,
      displayName: demo.displayName,
      role: 'user',
      onboardingCompleted: true,
      timezone: TIMEZONE,
    }).returning()

    await db.insert(schema.wallets).values({
      userId: user.id,
      balance: demo.balance,
      debt: demo.debt,
    })

    const [userGoal] = await db.insert(schema.goals).values({
      userId: user.id,
      title: 'Méditation quotidienne',
      type: 'recurring',
      category: 'Bien-être',
      recurrenceType: 'daily',
      recurrenceConfig: { dueTime: '08:00' },
    }).returning()

    const userOccDate = dateOffset(-1)
    const [userOcc] = await db.insert(schema.occurrences).values({
      goalId: userGoal.id,
      userId: user.id,
      dueDate: userOccDate,
      dueAt: dueAt(userOccDate, '08:00'),
      status: 'completed',
      processedAt: dueAt(userOccDate, '07:45'),
    }).returning()

    await db.insert(schema.validations).values({
      occurrenceId: userOcc.id,
      userId: user.id,
      status: demo.displayName === 'Lucas Bernard' ? 'pending_review' : 'approved',
      note: 'Méditation 10 minutes',
      proofType: 'text',
      proofContent: 'Session Calm terminée.',
      reviewedBy: demo.displayName === 'Lucas Bernard' ? undefined : admin.id,
      reviewedAt: demo.displayName === 'Lucas Bernard' ? undefined : new Date(),
    })

    await db.insert(schema.creditLedger).values({
      userId: user.id,
      type: 'signup_bonus',
      amount: 50,
      balanceAfter: 50,
      debtAfter: 0,
      reason: 'Bonus inscription',
    })
  }

  await db.insert(schema.auditLogs).values([
    {
      actorId: admin.id,
      action: 'seed.demo',
      entityType: 'system',
      details: { scope: 'admin-demo-data' },
    },
    {
      actorId: admin.id,
      action: 'validation.review',
      entityType: 'validation',
      details: { status: 'approved', note: 'Données de démonstration' },
    },
  ])

  return {
    skipped: false,
    adminEmail: admin.email,
    goals: 4,
    occurrences: insertedOccurrences.length + 2,
    demoUsers: demoUsers.length,
  }
}

async function clearUserDemoData(db: Db, userId: string) {
  const userGoals = await db.select({ id: schema.goals.id }).from(schema.goals).where(eq(schema.goals.userId, userId))
  const goalIds = userGoals.map(g => g.id)

  if (goalIds.length === 0) return

  for (const goalId of goalIds) {
    const occs = await db.select({ id: schema.occurrences.id }).from(schema.occurrences).where(eq(schema.occurrences.goalId, goalId))
    for (const occ of occs) {
      await db.delete(schema.validations).where(eq(schema.validations.occurrenceId, occ.id))
    }
    await db.delete(schema.occurrences).where(eq(schema.occurrences.goalId, goalId))
    await db.delete(schema.projectMilestones).where(eq(schema.projectMilestones.goalId, goalId))
  }

  await db.delete(schema.creditLedger).where(eq(schema.creditLedger.userId, userId))
  await db.delete(schema.goals).where(eq(schema.goals.userId, userId))
}
