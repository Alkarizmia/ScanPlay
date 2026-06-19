import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getAdSenseClientId } from '../lib/ads/config';
import { hasAdConsent, needsAdConsentPrompt } from '../lib/ads/consent';
import { ensureAdSenseScript, loadAdUnit, onAdConsentGranted } from '../lib/ads/adsense';

interface AdSenseSlotProps {
  slotId: string;
  className?: string;
  format?: 'auto' | 'rectangle' | 'horizontal';
  label?: string;
  onFillChange?: (filled: boolean) => void;
  emptyHint?: string;
  consentHint?: string;
}

export function AdSenseSlot({
  slotId,
  className = 'adsense-slot',
  format = 'auto',
  label = 'Publicité',
  onFillChange,
  emptyHint,
  consentHint,
}: AdSenseSlotProps) {
  const clientId = getAdSenseClientId();
  const insRef = useRef<HTMLModElement>(null);
  const onFillChangeRef = useRef(onFillChange);
  onFillChangeRef.current = onFillChange;
  const [filled, setFilled] = useState(false);
  const [checked, setChecked] = useState(false);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [loadGen, setLoadGen] = useState(0);

  useEffect(() => {
    setNeedsConsent(needsAdConsentPrompt() && !hasAdConsent());
  }, [loadGen]);

  useLayoutEffect(() => {
    if (!clientId) return;
    const ins = insRef.current;
    if (!ins) return;

    let cancelled = false;

    const run = async () => {
      setFilled(false);
      setChecked(false);
      onFillChangeRef.current?.(false);

      try {
        if (needsAdConsentPrompt() && !hasAdConsent()) {
          if (!cancelled) setNeedsConsent(true);
          return;
        }

        setNeedsConsent(false);
        await ensureAdSenseScript();
        if (cancelled) return;

        const ok = await loadAdUnit(ins);
        if (cancelled) return;
        setFilled(ok);
        setChecked(true);
        onFillChangeRef.current?.(ok);
      } catch {
        if (!cancelled) {
          setFilled(false);
          setChecked(true);
          onFillChangeRef.current?.(false);
        }
      }
    };

    void run();

    const unsub = onAdConsentGranted(() => {
      if (!cancelled) setLoadGen((g) => g + 1);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [clientId, slotId, loadGen]);

  if (!clientId) return null;

  return (
    <div className={className} aria-label={label}>
      <p className="adsense-label">{label}</p>
      {needsConsent && (
        <p className="adsense-consent-hint">{consentHint ?? emptyHint}</p>
      )}
      <ins
        key={`${slotId}-${loadGen}`}
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center', minHeight: 250 }}
        data-ad-client={clientId}
        data-ad-slot={slotId}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
      {checked && !filled && !needsConsent && emptyHint && (
        <p className="adsense-empty-hint">{emptyHint}</p>
      )}
    </div>
  );
}
