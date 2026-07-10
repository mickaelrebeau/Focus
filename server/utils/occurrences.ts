import {
  addDays,
  startOfWeek,
  endOfWeek,
  format,
  parseISO,
  isBefore,
  isAfter,
} from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import type { Goal, ProjectMilestone } from '../database/schema'

export function getWeekKey(date: Date, timezone: string): string {
  const zoned = toZonedTime(date, timezone)
  const weekStart = startOfWeek(zoned, { weekStartsOn: 1 })
  return format(weekStart, 'yyyy-ww')
}

export function computeDueAt(dueDate: string, dueTime: string, timezone: string): Date {
  const [hours, minutes] = dueTime.split(':').map(Number)
  const localDateStr = `${dueDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  return fromZonedTime(localDateStr, timezone)
}

export function generateOccurrenceDates(
  goal: Goal,
  timezone: string,
  fromDate: Date,
  toDate: Date,
): Array<{ dueDate: string; dueAt: Date; weekKey?: string; milestoneId?: string }> {
  const results: Array<{ dueDate: string; dueAt: Date; weekKey?: string; milestoneId?: string }> = []
  const dueTime = goal.recurrenceConfig?.dueTime ?? '23:59'

  if (goal.type === 'one_time' && goal.dueDate) {
    const dueAt = computeDueAt(goal.dueDate, dueTime, timezone)
    if (!isBefore(dueAt, fromDate) && !isAfter(dueAt, toDate)) {
      results.push({ dueDate: goal.dueDate, dueAt })
    }
    return results
  }

  if (goal.type === 'recurring' && goal.recurrenceType) {
    let current = toZonedTime(fromDate, timezone)
    const end = toZonedTime(toDate, timezone)

    while (!isAfter(current, end)) {
      const dateStr = format(current, 'yyyy-MM-dd')
      let include = false

      if (goal.recurrenceType === 'daily') {
        include = true
      } else if (goal.recurrenceType === 'weekly_days') {
        const dayOfWeek = current.getDay()
        const days = goal.recurrenceConfig?.daysOfWeek ?? []
        include = days.includes(dayOfWeek)
      } else if (goal.recurrenceType === 'weekly_count') {
        include = true
      }

      if (include) {
        const dueAt = computeDueAt(dateStr, dueTime, timezone)
        if (!isBefore(dueAt, fromDate) && !isAfter(dueAt, toDate)) {
          results.push({
            dueDate: dateStr,
            dueAt,
            weekKey: goal.recurrenceType === 'weekly_count'
              ? getWeekKey(current, timezone)
              : undefined,
          })
        }
      }
      current = addDays(current, 1)
    }
  }

  return results
}

export function generateMilestoneOccurrences(
  milestones: ProjectMilestone[],
  timezone: string,
  fromDate: Date,
  toDate: Date,
): Array<{ dueDate: string; dueAt: Date; milestoneId: string }> {
  const results: Array<{ dueDate: string; dueAt: Date; milestoneId: string }> = []

  for (const milestone of milestones) {
    if (!milestone.dueDate) continue
    const dueAt = computeDueAt(milestone.dueDate, '23:59', timezone)
    if (!isBefore(dueAt, fromDate) && !isAfter(dueAt, toDate)) {
      results.push({
        dueDate: milestone.dueDate,
        dueAt,
        milestoneId: milestone.id,
      })
    }
  }

  return results
}

export function isOccurrenceExpired(dueAt: Date, now = new Date()): boolean {
  return isAfter(now, dueAt)
}

export function getTodayInTimezone(timezone: string): string {
  const now = toZonedTime(new Date(), timezone)
  return format(now, 'yyyy-MM-dd')
}

export function getDateRange(days: number, timezone: string): { from: Date; to: Date } {
  const now = new Date()
  const zonedNow = toZonedTime(now, timezone)
  const from = fromZonedTime(format(zonedNow, 'yyyy-MM-dd') + 'T00:00:00', timezone)
  const toDate = addDays(zonedNow, days)
  const to = fromZonedTime(format(toDate, 'yyyy-MM-dd') + 'T23:59:59', timezone)
  return { from, to }
}
