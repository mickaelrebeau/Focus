export interface TimezoneOption {
  value: string
  label: string
  group: string
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { value: 'Europe/Paris', label: 'Paris (UTC+1/+2)', group: 'Europe' },
  { value: 'Europe/London', label: 'Londres (UTC+0/+1)', group: 'Europe' },
  { value: 'Europe/Brussels', label: 'Bruxelles (UTC+1/+2)', group: 'Europe' },
  { value: 'Europe/Zurich', label: 'Zurich (UTC+1/+2)', group: 'Europe' },
  { value: 'Europe/Berlin', label: 'Berlin (UTC+1/+2)', group: 'Europe' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1/+2)', group: 'Europe' },
  { value: 'Europe/Rome', label: 'Rome (UTC+1/+2)', group: 'Europe' },
  { value: 'Europe/Lisbon', label: 'Lisbonne (UTC+0/+1)', group: 'Europe' },
  { value: 'Europe/Athens', label: 'Athènes (UTC+2/+3)', group: 'Europe' },
  { value: 'Europe/Moscow', label: 'Moscou (UTC+3)', group: 'Europe' },

  { value: 'Africa/Casablanca', label: 'Casablanca (UTC+1)', group: 'Afrique' },
  { value: 'Africa/Algiers', label: 'Alger (UTC+1)', group: 'Afrique' },
  { value: 'Africa/Tunis', label: 'Tunis (UTC+1)', group: 'Afrique' },
  { value: 'Africa/Dakar', label: 'Dakar (UTC+0)', group: 'Afrique' },
  { value: 'Indian/Reunion', label: 'La Réunion (UTC+4)', group: 'Afrique' },
  { value: 'Indian/Mauritius', label: 'Maurice (UTC+4)', group: 'Afrique' },

  { value: 'America/Montreal', label: 'Montréal (UTC-5/-4)', group: 'Amériques' },
  { value: 'America/Toronto', label: 'Toronto (UTC-5/-4)', group: 'Amériques' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)', group: 'Amériques' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)', group: 'Amériques' },
  { value: 'America/Denver', label: 'Denver (UTC-7/-6)', group: 'Amériques' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)', group: 'Amériques' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)', group: 'Amériques' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)', group: 'Amériques' },

  { value: 'Asia/Dubai', label: 'Dubaï (UTC+4)', group: 'Asie & Océanie' },
  { value: 'Asia/Tokyo', label: 'Tokyo (UTC+9)', group: 'Asie & Océanie' },
  { value: 'Asia/Shanghai', label: 'Shanghai (UTC+8)', group: 'Asie & Océanie' },
  { value: 'Asia/Singapore', label: 'Singapour (UTC+8)', group: 'Asie & Océanie' },
  { value: 'Australia/Sydney', label: 'Sydney (UTC+10/+11)', group: 'Asie & Océanie' },
  { value: 'Pacific/Tahiti', label: 'Tahiti (UTC-10)', group: 'Asie & Océanie' },
  { value: 'Pacific/Auckland', label: 'Auckland (UTC+12/+13)', group: 'Asie & Océanie' },

  { value: 'UTC', label: 'UTC (temps universel)', group: 'Autre' },
]

export const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map(tz => tz.value) as [string, ...string[]]

export const DEFAULT_TIMEZONE = 'Europe/Paris'

export function getTimezoneGroups() {
  const groups = new Map<string, TimezoneOption[]>()
  for (const option of TIMEZONE_OPTIONS) {
    const list = groups.get(option.group) ?? []
    list.push(option)
    groups.set(option.group, list)
  }
  return groups
}

export function isValidTimezone(value: string): boolean {
  return TIMEZONE_VALUES.includes(value)
}
