import { defineStore } from 'pinia'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const activeFilter = ref<'all' | 'today' | 'week' | 'overdue'>('today')

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function setFilter(filter: typeof activeFilter.value) {
    activeFilter.value = filter
  }

  return {
    sidebarOpen,
    activeFilter,
    toggleSidebar,
    setFilter,
  }
})
