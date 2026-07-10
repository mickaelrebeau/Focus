import type { Ref } from 'vue'

export function useLandingMotion(containerRef: Ref<HTMLElement | null>) {
  const { gsap, ScrollTrigger } = useGSAP()
  let lenis: { destroy: () => void; raf: (time: number) => void; on: (event: string, cb: () => void) => void } | null = null
  let ctx: { revert: () => void } | null = null
  let mm: { revert: () => void } | null = null

  onMounted(async () => {
    if (!containerRef.value || !gsap || !ScrollTrigger) return

    const LenisModule = await import('lenis')
    const LenisClass = LenisModule.default

    lenis = new LenisClass({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    lenis.on('scroll', ScrollTrigger.update)

    const rafCallback = (time: number) => {
      lenis?.raf(time * 1000)
    }
    gsap.ticker.add(rafCallback)
    gsap.ticker.lagSmoothing(0)

    ctx = gsap.context(() => {
      mm = gsap.matchMedia()

      mm.add(
        {
          isDesktop: '(min-width: 1024px)',
          reduceMotion: '(prefers-reduced-motion: reduce)',
        },
        (context) => {
          const { isDesktop, reduceMotion } = context.conditions
          const duration = reduceMotion ? 0 : isDesktop ? 1 : 0.6

          gsap.from('.landing-hero-title', {
            y: 40,
            autoAlpha: 0,
            duration,
            ease: 'power3.out',
          })

          gsap.from('.landing-hero-subtitle', {
            y: 30,
            autoAlpha: 0,
            duration,
            delay: reduceMotion ? 0 : 0.15,
            ease: 'power3.out',
          })

          gsap.from('.landing-hero-cta', {
            y: 20,
            autoAlpha: 0,
            duration,
            delay: reduceMotion ? 0 : 0.3,
            ease: 'power3.out',
          })

          if (!reduceMotion) {
            gsap.utils.toArray<HTMLElement>('.landing-reveal').forEach((el) => {
              gsap.from(el, {
                y: 50,
                autoAlpha: 0,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: el,
                  start: 'top 85%',
                  toggleActions: 'play none none reverse',
                },
              })
            })

            gsap.utils.toArray<HTMLElement>('.landing-mockup').forEach((el) => {
              gsap.from(el, {
                y: 60,
                scale: 0.95,
                autoAlpha: 0,
                duration: 1,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: el,
                  start: 'top 80%',
                  toggleActions: 'play none none reverse',
                },
              })
            })
          }
        },
        containerRef.value,
      )
    }, containerRef.value)

    ScrollTrigger.refresh()
  })

  onUnmounted(() => {
    ctx?.revert()
    mm?.revert()
    lenis?.destroy()
  })
}
