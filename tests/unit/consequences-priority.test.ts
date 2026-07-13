import { describe, it, expect } from 'vitest'

type ConsequenceConfig = {
  id: string
  type: string
  enabled: boolean
  priority: number
}

function getActiveConsequencesSorted(configs: ConsequenceConfig[]) {
  return configs
    .filter(config => config.enabled)
    .sort((a, b) => a.priority - b.priority)
}

function reorderByIds(configs: ConsequenceConfig[], orderedIds: string[]) {
  const map = new Map(configs.map(config => [config.id, config]))
  return orderedIds
    .map((id, index) => {
      const config = map.get(id)
      if (!config) return null
      return { ...config, priority: index }
    })
    .filter((config): config is ConsequenceConfig => config !== null)
}

describe('consequences priority', () => {
  it('sorts active consequences by ascending priority', () => {
    const sorted = getActiveConsequencesSorted([
      { id: '1', type: 'donation', enabled: true, priority: 2 },
      { id: '2', type: 'credits', enabled: true, priority: 0 },
      { id: '3', type: 'custom', enabled: false, priority: 1 },
      { id: '4', type: 'community-pot', enabled: true, priority: 1 },
    ])

    expect(sorted.map(item => item.id)).toEqual(['2', '4', '1'])
  })

  it('reorders consequences by id list', () => {
    const configs = [
      { id: 'a', type: 'credits', enabled: true, priority: 0 },
      { id: 'b', type: 'donation', enabled: true, priority: 1 },
      { id: 'c', type: 'custom', enabled: true, priority: 2 },
    ]

    const reordered = reorderByIds(configs, ['c', 'a', 'b'])
    expect(reordered.map(item => ({ id: item.id, priority: item.priority }))).toEqual([
      { id: 'c', priority: 0 },
      { id: 'a', priority: 1 },
      { id: 'b', priority: 2 },
    ])
  })
})
