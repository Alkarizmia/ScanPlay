import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { LANDING_LANGS, lt, type LandingLang } from '../../lib/landingI18n';

interface LanguageMenuProps {
  lang: LandingLang;
  onChange: (lang: LandingLang) => void;
}

export function LanguageMenu({ lang, onChange }: LanguageMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = LANDING_LANGS.find((item) => item.id === lang) ?? LANDING_LANGS[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const selected = LANDING_LANGS.findIndex((item) => item.id === lang);
    itemRefs.current[Math.max(0, selected)]?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, lang]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    items[next]?.focus();
  };

  const pick = (next: LandingLang) => {
    setOpen(false);
    buttonRef.current?.focus();
    if (next !== lang) onChange(next);
  };

  return (
    <div className={`lp-lang${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="lp-lang-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${lt('lpLangLabel', lang)} (${current.label})`}
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon />
        <span>{current.short}</span>
        <ChevronIcon />
      </button>

      <ul className="lp-lang-menu" role="menu" aria-label={lt('lpLangLabel', lang)} onKeyDown={onMenuKeyDown}>
        {LANDING_LANGS.map((item, index) => {
          const selected = item.id === lang;
          return (
            <li key={item.id} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                lang={item.id}
                tabIndex={open ? 0 : -1}
                className={`lp-lang-option${selected ? ' is-selected' : ''}`}
                onClick={() => pick(item.id)}
              >
                <span className="lp-lang-code" aria-hidden="true">
                  {item.short}
                </span>
                <span className="lp-lang-name">{item.label}</span>
                {selected && <CheckIcon />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="lp-lang-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="lp-lang-check" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
