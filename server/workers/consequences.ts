import { loadEnvFile } from '../utils/load-env'

loadEnvFile()

import { Worker } from 'bullmq'
import { executeConsequenceHistory, recoverPendingConsequenceJobs } from '../utils/consequences-service'
import { QUEUE_NAME } from '../utils/consequences-queue'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const connection = { url: REDIS_URL }

const worker = new Worker(QUEUE_NAME, async (job) => {
  const { historyId } = job.data as { historyId: string }
  if (!historyId) {
    throw new Error('Job sans historyId')
  }

  console.log(`[Consequences Worker] Exécution history=${historyId}`)
  await executeConsequenceHistory(historyId)
}, {
  connection,
  concurrency: 5,
})

worker.on('completed', (job) => {
  console.log(`[Consequences Worker] Job ${job.id} terminé`)
})

worker.on('failed', (job, err) => {
  console.error(`[Consequences Worker] Job ${job?.id} échoué:`, err.message)
})

const recovered = await recoverPendingConsequenceJobs()
console.log(`[Consequences Worker] Reprise de ${recovered.recovered} job(s) en attente`)
console.log('[Consequences Worker] Démarré')
