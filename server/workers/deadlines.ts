import { loadEnvFile } from '../utils/load-env'

loadEnvFile()

import { Queue, Worker } from 'bullmq'
import { processExpiredOccurrences, generateUpcomingOccurrences } from '../utils/goals-service'
import { processStreaksAfterExpiration } from '../utils/streaks'
import { runLeaderboardJobs } from '../utils/leaderboard'

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
    console.log('[Worker] Done:', { expired, generated, streaks, leaderboard })
  } catch (error) {
    console.error('[Worker] Tick failed:', error)
    throw error
  }
}

const worker = new Worker('focus-deadlines', async () => {
  try {
    await runTick()
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

// Run immediately on startup
await runTick()

console.log('[Worker] Focus deadlines worker started')
