export class ConsequenceError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'ConsequenceError'
    this.statusCode = statusCode
  }
}

export function toHttpError(error: unknown): never {
  if (error instanceof ConsequenceError) {
    throw createError({ statusCode: error.statusCode, message: error.message })
  }
  throw error
}
