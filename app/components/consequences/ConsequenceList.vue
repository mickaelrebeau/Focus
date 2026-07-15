<script setup lang="ts">
import Sortable from 'sortablejs'
import ConsequenceCard from '~/components/consequences/ConsequenceCard.vue'
import type { ConsequenceType, UserConsequence } from '~/composables/useConsequences'

const props = defineProps<{
  consequences: UserConsequence[]
  types: ConsequenceType[]
  estimates: Record<string, { label: string, description: string } | null>
  savingId?: string | null
}>()

const emit = defineEmits<{
  update: [id: string, payload: {
    enabled?: boolean
    amount?: number
    config?: Record<string, unknown>
  }]
  remove: [id: string]
  reorder: [orderedIds: string[]]
}>()

const listRef = ref<HTMLElement | null>(null)
const localOrder = ref<UserConsequence[]>([])

watch(() => props.consequences, (value) => {
  localOrder.value = [...value].sort((a, b) => a.priority - b.priority)
}, { immediate: true, deep: true })

const typeMap = computed(() => {
  const map = new Map<string, ConsequenceType>()
  for (const type of props.types) {
    map.set(type.key, type)
  }
  return map
})

function moveItem(index: number, direction: -1 | 1) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= localOrder.value.length) return

  const items = [...localOrder.value]
  const [item] = items.splice(index, 1)
  if (!item) return
  items.splice(nextIndex, 0, item)
  localOrder.value = items
  emit('reorder', items.map(entry => entry.id))
}

onMounted(() => {
  if (!listRef.value) return

  Sortable.create(listRef.value, {
    handle: '.drag-handle',
    animation: 150,
    touchStartThreshold: 4,
    onEnd: (event) => {
      if (event.oldIndex === undefined || event.newIndex === undefined) return
      if (event.oldIndex === event.newIndex) return

      const items = [...localOrder.value]
      const [moved] = items.splice(event.oldIndex, 1)
      if (!moved) return
      items.splice(event.newIndex, 0, moved)
      localOrder.value = items
      emit('reorder', items.map(entry => entry.id))
    },
  })
})
</script>

<template>
  <div ref="listRef" class="space-y-4">
    <ConsequenceCard
      v-for="(consequence, index) in localOrder"
      :key="consequence.id"
      :consequence="consequence"
      :type-info="typeMap.get(consequence.type)"
      :estimate="estimates[consequence.id] ?? null"
      :saving="savingId === consequence.id"
      :is-first="index === 0"
      :is-last="index === localOrder.length - 1"
      @update="emit('update', consequence.id, $event)"
      @remove="emit('remove', consequence.id)"
      @move-up="moveItem(index, -1)"
      @move-down="moveItem(index, 1)"
    />
  </div>
</template>
