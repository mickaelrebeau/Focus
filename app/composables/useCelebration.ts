import { gsap } from 'gsap'

const COLORS = ['#111827', '#fbbf24', '#34d399', '#f97316', '#ffffff', '#86868B']

export function useCelebration() {
  const container = ref<HTMLElement | null>(null)
  let ctx: gsap.Context | null = null

  function prefersReducedMotion() {
    if (import.meta.server) return true
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function burst(target?: HTMLElement | null) {
    if (import.meta.server || prefersReducedMotion()) return

    const host = target ?? container.value
    if (!host) return

    ctx?.revert()
    ctx = gsap.context(() => {
      const rect = host.getBoundingClientRect()
      const originX = rect.left + rect.width / 2
      const originY = rect.top + rect.height / 2

      for (let i = 0; i < 48; i++) {
        const particle = document.createElement('span')
        particle.className = 'pointer-events-none fixed z-[60] block rounded-full'
        const size = 4 + Math.random() * 6
        particle.style.width = `${size}px`
        particle.style.height = `${size}px`
        particle.style.left = `${originX}px`
        particle.style.top = `${originY}px`
        particle.style.background = COLORS[i % COLORS.length]!
        document.body.appendChild(particle)

        const angle = (Math.PI * 2 * i) / 48
        const distance = 80 + Math.random() * 160
        const dx = Math.cos(angle) * distance
        const dy = Math.sin(angle) * distance

        gsap.to(particle, {
          x: dx,
          y: dy,
          opacity: 0,
          scale: 0,
          duration: 0.9 + Math.random() * 0.6,
          ease: 'power2.out',
          onComplete: () => particle.remove(),
        })
      }
    })
  }

  onBeforeUnmount(() => {
    ctx?.revert()
  })

  return { container, burst }
}
