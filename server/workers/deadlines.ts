import { loadEnvFile } from '../utils/load-env'

loadEnvFile()

import { Queue, Worker } from 'bullmq'
import { processExpiredOccurrences, generateUpcomingOccurrences } from '../utils/goals-service'
import { processStreaksAfterExpiration } from '../utils/streaks'
import { runLeaderboardJobs } from '../utils/leaderboard'
import { processPushReminders } from '../utils/push'
import { closeFinishedChallenges } from '../utils/challenges'
import { purgeDeletedAccounts } from '../utils/account-deletion'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const connection = { url: REDIS_URL }

const queue = new Queue('focus-deadlines', { connection })

async function runTick() {
  console.log('[Worker] Processing deadlines...')
  try {
    const expired = await processExpiredOccurrences()
    const generated = await generateUpcomingOccurrences()
    const streaks = await processStreaksAfterExpiration()
    const leaderboard = await runLeaderboardJobs()
    // Après la clôture des journées (streaks) : scores définitifs de la semaine
    const challenges = await closeFinishedChallenges()
    const accounts = await purgeDeletedAccounts()
    console.log('[Worker] Done:', { expired, generated, streaks, leaderboard, challenges, accounts })
  } catch (error) {
    console.error('[Worker] Tick failed:', error)
    throw error
  }
}

async function runPushReminders() {
  try {
    const result = await processPushReminders()
    if (result.reminders || result.streakWarnings) {
      console.log('[Worker] Push:', result)
    }
  } catch (error) {
    console.error('[Worker] Push reminders failed:', error)
  }
}

const worker = new Worker('focus-deadlines', async (job) => {
  try {
    if (job.name === 'push-reminders') {
      await runPushReminders()
    } else {
      await runTick()
    }
  } catch (error) {
    console.error('[Worker] Job error:', error)
  }
}, { connection })

worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message)
})

// Schedule recurring job every 15 minutes
await queue.add('tick', {}, {
  repeat: { every: 15 * 60 * 1000 },
  removeOnComplete: 100,
  removeOnFail: 50,
})

// Rappels push : plus fréquents que le tick, pour respecter le délai choisi par l'utilisateur
await queue.add('push-reminders', {}, {
  repeat: { every: 5 * 60 * 1000 },
  removeOnComplete: 100,
  removeOnFail: 50,
})

// Run immediately on startup
await runTick()

console.log('[Worker] Focus deadlines worker started')
