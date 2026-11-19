import { create } from 'zustand'

export type QualityTier = 0 | 1 | 2 // 0 low, 1 medium, 2 high

export const isLowPower =
  typeof navigator !== 'undefined' &&
  (navigator.hardwareConcurrency <= 4 || /Mobi/.test(navigator.userAgent))

export const prefersReducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface QualityState {
  tier: QualityTier
  setTier(t: QualityTier): void
}

export const useQuality = create<QualityState>((set) => ({
  tier: isLowPower ? 0 : 2,
  setTier: (tier) => set({ tier }),
}))
