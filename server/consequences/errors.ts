import { ZodError } from 'zod'

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
  // Configuration refusée par le schéma Zod d'un provider : erreur de saisie, pas erreur serveur
  if (error instanceof ZodError) {
    throw createError({ statusCode: 400, message: error.issues[0]?.message ?? 'Configuration invalide' })
  }
  throw error
}
