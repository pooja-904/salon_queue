import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

// Motion tokens (refero motion guide): enter = decelerate, exit = accelerate,
// nothing in product UI longer than ~400 ms except the "your turn" hero moment.
export const EASE_OUT = [0.05, 0.7, 0.1, 1] as const; // emphasized decelerate
export const EASE_IN = [0.3, 0, 0.8, 0.15] as const; // emphasized accelerate
export const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 } as const;

/**
 * Rolls a changing value: the old one slides up and fades, the new one rises in.
 * Used for tokens, waiting times, positions and counts so live updates feel smooth.
 */
export function Roll({ value, className }: { value: string | number; className?: string }) {
  return (
    <span className={`relative inline-grid overflow-hidden align-bottom ${className ?? ''}`}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={String(value)}
          style={{ gridArea: '1 / 1' }}
          initial={{ y: '55%', opacity: 0, filter: 'blur(4px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)', transition: { duration: 0.36, ease: EASE_OUT } }}
          exit={{ y: '-55%', opacity: 0, filter: 'blur(4px)', transition: { duration: 0.2, ease: EASE_IN } }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Smoothly opens/closes a block (banners, inline errors) instead of popping in. */
export function Reveal({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={className}
          style={{ overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.32, ease: EASE_OUT }, opacity: { duration: 0.24, delay: 0.06 } } }}
          exit={{ height: 0, opacity: 0, transition: { height: { duration: 0.22, ease: EASE_IN }, opacity: { duration: 0.12 } } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** List rows that slide in, collapse out and glide when the order changes. */
export const rowMotion = {
  layout: true,
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.2, ease: EASE_IN } },
  transition: { layout: { duration: 0.36, ease: EASE_OUT } },
} as const;
