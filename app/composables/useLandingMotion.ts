import type { Ref } from 'vue'
import type Lenis from 'lenis'

// Landing : défilement doux (Lenis) et apparitions légères (GSAP + ScrollTrigger).
// Tout est désactivé avec prefers-reduced-motion : le contenu reste visible et statique.
export function useLandingMotion(containerRef: Ref<HTMLElement | null>) {
  const { gsap, ScrollTrigger } = useGSAP()
  let lenis: Lenis | null = null
  let ctx: gsap.Context | null = null
  let rafCallback: ((time: number) => void) | null = null

  onMounted(async () => {
    const container = containerRef.value
    if (!container || !gsap || !ScrollTrigger) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    const { default: LenisClass } = await import('lenis')
    lenis = new LenisClass({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      anchors: true,
    })
    lenis.on('scroll', ScrollTrigger.update)
    rafCallback = (time: number) => lenis?.raf(time * 1000)
    gsap.ticker.add(rafCallback)
    gsap.ticker.lagSmoothing(0)

    ctx = gsap.context(() => {
      const ease = 'power3.out'

      // Hero : mots qui montent depuis leur masque, puis le reste en fondu
      gsap.timeline({ defaults: { ease } })
        .from('.landing-word', { yPercent: 110, duration: 0.9, stagger: 0.06 })
        .from('.landing-hero-fade', { y: 16, autoAlpha: 0, duration: 0.7, stagger: 0.08 }, '-=0.6')
        .from('.landing-preview', { y: 40, autoAlpha: 0, duration: 1 }, '-=0.5')

      // Aperçu : léger parallaxe, puis une échéance se coche et le solde monte
      gsap.to('.landing-preview', {
        y: -30,
        ease: 'none',
        scrollTrigger: { trigger: '.landing-preview', start: 'top bottom', end: 'bottom top', scrub: true },
      })
      const credits = container.querySelector<HTMLElement>('.landing-credits')
      const counter = { value: Number(credits?.dataset.from ?? 0) }
      if (credits) credits.textContent = String(counter.value)
      gsap.set('.landing-check-path', { strokeDasharray: 24, strokeDashoffset: 24 })
      gsap.timeline({ scrollTrigger: { trigger: '.landing-preview', start: 'top 70%', once: true }, delay: 0.4 })
        .to('.landing-check', { backgroundColor: '#111111', borderColor: '#111111', duration: 0.3, ease: 'power2.out' })
        .to('.landing-check-path', { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, '-=0.1')
        .to('.landing-task-title', { color: '#a1a1a6', duration: 0.3 }, '<')
        .to(counter, {
          value: Number(credits?.dataset.to ?? 0),
          duration: 0.6,
          ease: 'power1.out',
          onUpdate: () => { if (credits) credits.textContent = String(Math.round(counter.value)) },
        }, '<')

      // Titres de section
      gsap.utils.toArray<HTMLElement>('.landing-reveal').forEach((el) => {
        gsap.from(el, { y: 20, autoAlpha: 0, duration: 0.7, ease, scrollTrigger: { trigger: el, start: 'top 88%', once: true } })
      })

      // Tuiles bento : apparition en cascade, par lot visible à l'écran
      gsap.set('.landing-tile', { y: 24, autoAlpha: 0 })
      ScrollTrigger.batch('.landing-tile', {
        start: 'top 90%',
        once: true,
        onEnter: batch => gsap.to(batch, { y: 0, autoAlpha: 1, duration: 0.7, ease, stagger: 0.08 }),
      })

      // Détails qui s'animent une fois leur tuile visible
      gsap.from('.landing-dot', {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 0.4,
        stagger: 0.07,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.landing-dot', start: 'top 90%', once: true },
      })
      gsap.from('.landing-bar', {
        scaleY: 0,
        duration: 0.8,
        stagger: 0.06,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.landing-bar', start: 'top 92%', once: true },
      })
      gsap.from('.landing-ledger', {
        x: 12,
        autoAlpha: 0,
        duration: 0.5,
        stagger: 0.1,
        ease,
        scrollTrigger: { trigger: '.landing-ledger', start: 'top 90%', once: true },
      })
      gsap.utils.toArray<HTMLElement>('.landing-count').forEach((el) => {
        const target = { value: 0 }
        gsap.to(target, {
          value: Number(el.dataset.to ?? 0),
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onUpdate: () => { el.textContent = String(Math.round(target.value)) },
        })
      })
      gsap.from('.landing-progress', {
        scaleX: 0,
        duration: 1.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.landing-progress', start: 'top 90%', once: true },
      })

      // Étapes : le trait se dessine au fil du défilement, les étapes suivent
      gsap.from('.landing-steps-line', {
        scaleX: 0,
        ease: 'none',
        scrollTrigger: { trigger: '.landing-steps', start: 'top 75%', end: 'bottom 60%', scrub: true },
      })
      gsap.from('.landing-step', {
        y: 20,
        autoAlpha: 0,
        duration: 0.6,
        stagger: 0.15,
        ease,
        scrollTrigger: { trigger: '.landing-steps', start: 'top 80%', once: true },
      })

      gsap.from('.landing-cta', {
        scale: 0.96,
        autoAlpha: 0,
        duration: 0.9,
        ease,
        scrollTrigger: { trigger: '.landing-cta', start: 'top 85%', once: true },
      })
    }, container)

    ScrollTrigger.refresh()
  })

  onUnmounted(() => {
    ctx?.revert()
    if (rafCallback && gsap) gsap.ticker.remove(rafCallback)
    lenis?.destroy()
    lenis = null
  })
}
