import { useEffect, useId, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useLang } from '../i18n/i18n';
import { EASE_IN, EASE_OUT, SPRING } from './motion';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

export function Logo({ dark = false, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cx(
          'flex items-center justify-center rounded-full font-medium',
          lg ? 'size-[68px] border-2 text-[30px]' : 'size-[34px] border-[1.5px] text-[15px]',
          dark ? 'border-white text-white' : 'border-ink text-ink',
        )}
        aria-hidden="true"
      >
        K
      </div>
      <div>
        <div className={cx('font-semibold tracking-[-0.01em]', lg ? 'text-[40px] leading-tight' : 'text-[15px]', dark ? 'text-white' : 'text-ink')}>
          Kesh Studio
        </div>
        {lg && <div className="text-[15px] font-medium tracking-[0.22em] text-white/60">HAIR &amp; GROOMING</div>}
      </div>
    </div>
  );
}

export function LangToggle({ dark = false }: { dark?: boolean }) {
  const { lang, setLang, t } = useLang();
  const pillId = useId();
  const options: { code: 'en' | 'gu'; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'gu', label: 'ગુ' },
  ];
  return (
    <div
      role="group"
      aria-label={t('lang.switch')}
      className={cx('flex gap-0.5 rounded-full p-[3px]', dark ? 'glass' : 'bg-white shadow-card ring-hair')}
    >
      {options.map((o) => {
        const active = lang === o.code;
        return (
          <button
            key={o.code}
            type="button"
            lang={o.code}
            aria-pressed={active}
            onClick={() => setLang(o.code)}
            className={cx(
              'press relative h-[38px] min-w-[44px] rounded-full px-3.5 text-[13px] font-medium',
              o.code === 'gu' && 'font-gu text-[15px]',
              active ? (dark ? 'text-ink' : 'text-white') : dark ? 'text-white' : 'text-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                transition={SPRING}
                className={cx('absolute inset-0 rounded-full', dark ? 'bg-white' : 'bg-ink')}
                aria-hidden="true"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TopBar({ dark = false, right }: { dark?: boolean; right?: ReactNode }) {
  return (
    <header className="flex h-[52px] items-center justify-between">
      <Logo dark={dark} />
      <div className="flex items-center gap-2">
        {right}
        <LangToggle dark={dark} />
      </div>
    </header>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-3xl bg-white shadow-card', className)}>{children}</div>;
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'light' }) {
  const styles = {
    primary: 'bg-ink text-white hover:bg-navy-800 disabled:bg-subtle/60',
    secondary: 'bg-white text-ink ring-hair hover:bg-canvas disabled:text-subtle',
    danger: 'bg-white text-danger ring-hair hover:bg-danger-bg',
    ghost: 'text-ink hover:bg-ink/5',
    light: 'bg-white text-ink hover:bg-frost disabled:opacity-60',
  }[variant];
  return (
    <button
      type="button"
      {...rest}
      className={cx('press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-medium', styles, className)}
    >
      {children}
    </button>
  );
}

export function ConnectionPill({ connected, dark = false }: { connected: boolean; dark?: boolean }) {
  const { t } = useLang();
  return (
    <AnimatePresence>
      {!connected && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -16, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%', transition: { duration: 0.3, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: -16, x: '-50%', transition: { duration: 0.18, ease: EASE_IN } }}
          className={cx(
            'fixed left-1/2 top-3 z-50 rounded-full px-4 py-2 text-[13px] font-medium shadow-card',
            dark ? 'bg-white text-ink' : 'bg-ink text-white',
          )}
        >
          {t('common.reconnecting')}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Countdown / progress ring. `fraction` = how much is still left (0–1). */
export function Ring({
  size,
  stroke,
  fraction,
  color,
  track,
  children,
}: {
  size: number;
  stroke: number;
  fraction: number;
  color: string;
  track: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.2, 0, 0, 1)' }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-3xl bg-white p-0 text-ink shadow-pass backdrop:bg-navy-950/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[13px] font-medium text-muted">
        <span>{label}</span>
        {hint && <span className="text-subtle">{hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.span
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto', transition: { duration: 0.26, ease: EASE_OUT } }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16, ease: EASE_IN } }}
            className="block overflow-hidden pt-1.5 text-[13px] text-danger"
          >
            {error}
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}

export const inputClass =
  'h-12 w-full rounded-2xl bg-white px-4 text-[16px] text-ink ring-hair outline-none transition-shadow duration-200 placeholder:text-subtle focus:shadow-[0_0_0_2px_var(--color-accent)]';

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDone, 3500);
    return () => clearTimeout(id);
  }, [message, onDone]);
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key={message}
          role="status"
          initial={{ opacity: 0, y: 24, x: '-50%', scale: 0.96 }}
          animate={{ opacity: 1, y: 0, x: '-50%', scale: 1, transition: { duration: 0.34, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: 12, x: '-50%', transition: { duration: 0.18, ease: EASE_IN } }}
          className="fixed bottom-6 left-1/2 z-50 rounded-2xl bg-ink px-5 py-3 text-[14px] font-medium text-white shadow-pass"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
