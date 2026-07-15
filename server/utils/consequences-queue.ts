import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const QUEUE_NAME = 'focus-consequences'

let queue: Queue | null = null

export function getConsequencesQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: { url: REDIS_URL },
    })
  }
  return queue
}

export async function enqueueConsequenceJob(historyId: string) {
  const consequencesQueue = getConsequencesQueue()
  await consequencesQueue.add(
    'execute',
    { historyId },
    {
      jobId: historyId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 100,
    },
  )
}

export { QUEUE_NAME }
