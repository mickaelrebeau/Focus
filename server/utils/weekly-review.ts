import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { and, asc, eq, gte, lt, lte } from 'drizzle-orm'
import { useDatabase, schema } from '../database'
import { getTodayInTimezone } from './occurrences'
import { expandPauseDates, getEffectivePauses } from './pauses'
import { calculateStreaksFromDates } from './streaks'

/**
 * Écritures du registre comptées comme gains ou pertes. `debt_created` et `debt_repayment`
 * sont exclues : ce ne sont que la ventilation comptable d'une pénalité ou d'un gain déjà
 * enregistré (les compter doublerait les montants).
 */
export const CREDIT_GAIN_TYPES = [
  'task_reward',
  'signup_bonus',
  'streak_bonus',
  'leaderboard_reward',
  'transfer_received',
  'admin_adjustment',
] as const
export const CREDIT_LOSS_TYPES = ['task_penalty', 'transfer_sent'] as const

export interface WeekRange {
  start: string
  end: string
  dates: string[]
}

/** Semaine du lundi au dimanche contenant `date` (dates locales `yyyy-MM-dd`). */
export function weekRange(date: string): WeekRange {
  const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 })
  const dates = Array.from({ length: 7 }, (_, index) => format(addDays(monday, index), 'yyyy-MM-dd'))
  return { start: dates[0]!, end: dates[6]!, dates }
}

export interface WeeklyReviewInput {
  week: WeekRange
  occurrences: Array<{ dueDate: string, status: string }>
  dailyResults: Array<{ dateKey: string, status: string }>
  ledger: Array<{ type: string, amount: number }>
  consequences: Array<{ provider: string, status: string }>
  pausedDates: ReadonlySet<string>
}

export function computeWeeklyReview(input: WeeklyReviewInput) {
  const inWeek = input.occurrences.filter(o => o.dueDate >= input.week.start && o.dueDate <= input.week.end)
  const count = (status: string) => inWeek.filter(o => o.status === status).length
  const completed = count('completed')
  const failed = count('failed')
  const closed = completed + failed

  const dayStatus = new Map(input.dailyResults.map(result => [result.dateKey, result.status]))
  const days = input.week.dates.map((date) => {
    const result = dayStatus.get(date)
    const status = result === 'success' || result === 'failed'
      ? result
      : input.pausedDates.has(date) ? 'paused' : 'neutral'
    return { date, status: status as 'success' | 'failed' | 'paused' | 'neutral' }
  })
  const successDates = days.filter(day => day.status === 'success').map(day => day.date)

  const gained = input.ledger
    .filter(entry => (CREDIT_GAIN_TYPES as readonly string[]).includes(entry.type))
    .reduce((sum, entry) => sum + entry.amount, 0)
  const lost = input.ledger
    .filter(entry => (CREDIT_LOSS_TYPES as readonly string[]).includes(entry.type))
    .reduce((sum, entry) => sum + Math.abs(entry.amount), 0)

  const consequencesByProvider: Record<string, number> = {}
  for (const consequence of input.consequences) {
    if (consequence.status === 'cancelled') continue
    consequencesByProvider[consequence.provider] = (consequencesByProvider[consequence.provider] ?? 0) + 1
  }

  return {
    week: { start: input.week.start, end: input.week.end },
    occurrences: {
      total: inWeek.length,
      completed,
      failed,
      pending: count('pending'),
      paused: count('skipped'),
      // Sur les échéances clôturées : une échéance encore à faire n'est ni un succès ni un échec
      successRate: closed === 0 ? null : Math.round((completed / closed) * 100),
    },
    days: {
      perfect: days.filter(day => day.status === 'success').length,
      failed: days.filter(day => day.status === 'failed').length,
      paused: days.filter(day => day.status === 'paused').length,
      list: days,
    },
    credits: { gained, lost, net: gained - lost },
    consequences: {
      total: Object.values(consequencesByProvider).reduce((sum, n) => sum + n, 0),
      byProvider: consequencesByProvider,
    },
    // Plus longue suite de jours parfaits de la semaine (jours de pause gelés)
    bestStreak: successDates.length ? calculateStreaksFromDates(successDates, input.pausedDates).longest : 0,
  }
}

export type WeeklyReview = ReturnType<typeof computeWeeklyReview>

/** Bornes UTC de la semaine locale : [lundi 00:00, lundi suivant 00:00[. */
function weekInstants(week: WeekRange, timezone: string) {
  const nextMonday = format(addDays(parseISO(week.start), 7), 'yyyy-MM-dd')
  return {
    from: fromZonedTime(`${week.start}T00:00:00`, timezone),
    to: fromZonedTime(`${nextMonday}T00:00:00`, timezone),
  }
}

export function resolveReviewWeek(requested: unknown, timezone: string) {
  const today = getTodayInTimezone(timezone)
  const current = weekRange(today)
  const valid = typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested)
  const week = valid ? weekRange(requested) : current
  // Pas de bilan pour une semaine future
  return week.start > current.start ? current : week
}

export async function loadWeeklyData(user: { id: string, timezone: string }, week: WeekRange) {
  const db = useDatabase()
  const { from, to } = weekInstants(week, user.timezone)

  const [occurrences, dailyResults, ledger, consequences, pauses] = await Promise.all([
    db
      .select({
        dueDate: schema.occurrences.dueDate,
        dueAt: schema.occurrences.dueAt,
        status: schema.occurrences.status,
        title: schema.goals.title,
        processedAt: schema.occurrences.processedAt,
      })
      .from(schema.occurrences)
      .innerJoin(schema.goals, eq(schema.goals.id, schema.occurrences.goalId))
      .where(and(
        eq(schema.occurrences.userId, user.id),
        gte(schema.occurrences.dueDate, week.start),
        lte(schema.occurrences.dueDate, week.end),
      ))
      .orderBy(asc(schema.occurrences.dueAt)),
    db
      .select({ dateKey: schema.userDailyResults.dateKey, status: schema.userDailyResults.status })
      .from(schema.userDailyResults)
      .where(and(
        eq(schema.userDailyResults.userId, user.id),
        gte(schema.userDailyResults.dateKey, week.start),
        lte(schema.userDailyResults.dateKey, week.end),
      )),
    db
      .select({
        type: schema.creditLedger.type,
        amount: schema.creditLedger.amount,
        reason: schema.creditLedger.reason,
        createdAt: schema.creditLedger.createdAt,
      })
      .from(schema.creditLedger)
      .where(and(
        eq(schema.creditLedger.userId, user.id),
        gte(schema.creditLedger.createdAt, from),
        lt(schema.creditLedger.createdAt, to),
      ))
      .orderBy(asc(schema.creditLedger.createdAt)),
    db
      .select({ provider: schema.consequenceHistory.provider, status: schema.consequenceHistory.status })
      .from(schema.consequenceHistory)
      .where(and(
        eq(schema.consequenceHistory.userId, user.id),
        gte(schema.consequenceHistory.createdAt, from),
        lt(schema.consequenceHistory.createdAt, to),
      )),
    getEffectivePauses(user.id),
  ])

  return { occurrences, dailyResults, ledger, consequences, pausedDates: expandPauseDates(pauses) }
}

const CSV_HEADER = ['date', 'type', 'libelle', 'statut', 'credits']

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  // Protège contre l'injection de formules à l'ouverture dans un tableur
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === 'string' ? `'${text}` : text
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Export CSV de la semaine : échéances et mouvements de crédits (UTF-8 avec BOM, pour Excel). */
export function buildWeeklyCsv(
  data: Awaited<ReturnType<typeof loadWeeklyData>>,
  timezone: string,
) {
  const rows: Array<Array<string | number | null>> = []
  for (const occurrence of data.occurrences) {
    rows.push([occurrence.dueDate, 'echeance', occurrence.title, occurrence.status, null])
  }
  for (const entry of data.ledger) {
    const localDate = formatInTimeZone(entry.createdAt, timezone, 'yyyy-MM-dd')
    rows.push([localDate, 'credit', entry.reason ?? entry.type, entry.type, entry.amount])
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))
  const lines = [CSV_HEADER, ...rows].map(row => row.map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
