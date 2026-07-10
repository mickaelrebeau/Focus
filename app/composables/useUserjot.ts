export function useUserjot() {
  const config = useRuntimeConfig()
  const isEnabled = computed(() => !!config.public.userjotProjectId)

  function showFeedback() {
    if (!isEnabled.value || !import.meta.client) return
    window.uj?.showWidget({ section: 'feedback' })
  }

  function showRoadmap() {
    if (!isEnabled.value || !import.meta.client) return
    window.uj?.showWidget({ section: 'roadmap' })
  }

  function hideWidget() {
    if (!import.meta.client) return
    window.uj?.hideWidget()
  }

  return {
    isEnabled,
    showFeedback,
    showRoadmap,
    hideWidget,
  }
}
