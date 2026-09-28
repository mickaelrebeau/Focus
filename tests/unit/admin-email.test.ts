import { describe, it, expect, vi, afterEach } from 'vitest'

const runtimeConfig = vi.hoisted(() => ({ adminEmail: '' }))
vi.stubGlobal('useRuntimeConfig', () => runtimeConfig)

vi.mock('../../server/database', () => ({ useDatabase: vi.fn(), schema: {} }))

import { isConfiguredAdminEmail } from '../../server/utils/auth'

describe('isConfiguredAdminEmail', () => {
  afterEach(() => {
    runtimeConfig.adminEmail = ''
  })

  it('ne désigne aucun administrateur si ADMIN_EMAIL n’est pas défini', () => {
    expect(isConfiguredAdminEmail('someone@example.com')).toBe(false)
    expect(isConfiguredAdminEmail('')).toBe(false)
  })

  it('reconnaît l’email configuré, sans tenir compte de la casse ni des espaces', () => {
    runtimeConfig.adminEmail = ' Admin@Example.org '
    expect(isConfiguredAdminEmail('admin@example.org')).toBe(true)
    expect(isConfiguredAdminEmail('ADMIN@EXAMPLE.ORG ')).toBe(true)
  })

  it('refuse toute autre adresse', () => {
    runtimeConfig.adminEmail = 'admin@example.org'
    expect(isConfiguredAdminEmail('admin@example.com')).toBe(false)
    expect(isConfiguredAdminEmail('someone@example.org')).toBe(false)
  })
})
