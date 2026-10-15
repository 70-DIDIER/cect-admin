import type { Variants, Transition } from 'framer-motion'

// ─── Easing curves ───────────────────────────────────────────
export const ease = {
  out: [0.16, 1, 0.3, 1],      // expo-out — fast start, smooth finish
  inOut: [0.45, 0, 0.55, 1],   // sine-inOut — symmetric
  smooth: [0.4, 0, 0.2, 1],    // material standard
} as const

// ─── Shared transition presets ───────────────────────────────
export const transition = {
  fast: { duration: 0.25, ease: ease.out } satisfies Transition,
  base: { duration: 0.45, ease: ease.out } satisfies Transition,
  slow: { duration: 0.65, ease: ease.out } satisfies Transition,
  page: { duration: 0.35, ease: ease.inOut } satisfies Transition,
}

// ─── Reusable variants ────────────────────────────────────────
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1 },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 24 },
  show:   { opacity: 1, x: 0 },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show:   { opacity: 1, scale: 1 },
}

// stagger container — apply to parent
export const staggerContainer = (stagger = 0.08, delayChildren = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren } },
})

// ─── Page transition ─────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter:   { opacity: 1, y: 0, transition: transition.page },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.2, ease: ease.inOut } },
}
