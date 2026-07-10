import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let registered = false

export function useGSAP() {
  if (import.meta.server) {
    return {
      gsap: null as typeof gsap | null,
      ScrollTrigger: null as typeof ScrollTrigger | null,
    }
  }

  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }

  return { gsap, ScrollTrigger }
}
