import { useCallback, useEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from 'react';

import { lt, type LandingCopyKey } from '../../lib/landingI18n';
import type { Locale } from '../../types';

const RESET_MS = 10_000;
const FLY_MS = 320;
const THRESHOLD = 72;

export interface StepCard {
  num: string;
  title: LandingCopyKey;
  body: LandingCopyKey;
  icon: ComponentType;
}

interface StepsSwipeDeckProps {
  steps: readonly StepCard[];
  locale: Locale;
}

export function StepsSwipeDeck({ steps, locale }: StepsSwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState(false);
  const dxRef = useRef(0);
  const flyTimerRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    locked: boolean | null;
    lastX: number;
    lastT: number;
    vx: number;
  } | null>(null);
  const flyingRef = useRef(false);
  const resetRef = useRef<number | null>(null);

  const remaining = steps.length - index;
  const allGone = remaining <= 0;

  const clearReset = () => {
    if (resetRef.current != null) {
      window.clearTimeout(resetRef.current);
      resetRef.current = null;
    }
  };

  const clearFly = () => {
    if (flyTimerRef.current != null) {
      window.clearTimeout(flyTimerRef.current);
      flyTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearReset();
      clearFly();
    },
    [],
  );

  useEffect(() => {
    if (!allGone) return;
    clearReset();
    resetRef.current = window.setTimeout(() => {
      setIndex(0);
      dxRef.current = 0;
      setDx(0);
      setFlying(false);
      flyingRef.current = false;
    }, RESET_MS);
    return clearReset;
  }, [allGone]);

  const dismiss = useCallback((dir: 1 | -1) => {
    if (flyingRef.current) return;
    flyingRef.current = true;
    setFlying(true);
    dxRef.current = dir * 480;
    setDx(dir * 480);
    clearFly();
    flyTimerRef.current = window.setTimeout(() => {
      setIndex((current) => current + 1);
      dxRef.current = 0;
      setDx(0);
      setFlying(false);
      flyingRef.current = false;
      dragRef.current = null;
    }, FLY_MS);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (flyingRef.current || allGone) return;
    if (event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      locked: null,
      lastX: event.clientX,
      lastT: event.timeStamp,
      vx: 0,
    };
    dxRef.current = 0;
    setDx(0);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || flyingRef.current) return;

    const moveX = event.clientX - drag.startX;
    const moveY = event.clientY - drag.startY;
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    drag.vx = ((event.clientX - drag.lastX) / dt) * 16;
    drag.lastX = event.clientX;
    drag.lastT = event.timeStamp;

    if (drag.locked == null) {
      if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return;
      if (Math.abs(moveY) > Math.abs(moveX)) {
        drag.locked = false;
        dragRef.current = null;
        setDx(0);
        return;
      }
      drag.locked = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!drag.locked) return;
    event.preventDefault();
    dxRef.current = moveX;
    setDx(moveX);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    if (drag.locked !== true || flyingRef.current) {
      setDx(0);
      return;
    }
    const offset = dxRef.current;
    const shouldGo = Math.abs(offset) > THRESHOLD || Math.abs(drag.vx) > 8;
    if (shouldGo) dismiss(offset === 0 ? (drag.vx >= 0 ? 1 : -1) : offset > 0 ? 1 : -1);
    else {
      dxRef.current = 0;
      setDx(0);
    }
  };

  return (
    <div className={`lp-swipe${allGone ? ' is-empty' : ''}`}>
      {allGone ? (
        <div className="lp-swipe-arrow" aria-hidden="true">
          <DownArrow />
        </div>
      ) : (
        <div
          className="lp-swipe-deck"
          role="group"
          aria-label={lt('lpStepsTitle', locale)}
        >
          {steps.map((step, stepIndex) => {
            if (stepIndex < index) return null;
            const depth = stepIndex - index;
            const isTop = depth === 0;
            const Icon = step.icon;
            return (
              <article
                key={step.num}
                className={`lp-swipe-card lp-swipe-card--${step.num}${isTop ? ' is-top' : ''}${isTop && flying ? ' is-flying' : ''}${isTop && dx !== 0 && !flying ? ' is-dragging' : ''}`}
                style={{
                  zIndex: steps.length - depth,
                  ['--stack-y' as string]: `${depth * 11}px`,
                  ['--stack-scale' as string]: `${1 - depth * 0.035}`,
                  ['--drag-x' as string]: isTop ? `${dx}px` : '0px',
                  ['--drag-rot' as string]: isTop ? `${dx * 0.045}deg` : '0deg',
                }}
                onPointerDown={isTop ? onPointerDown : undefined}
                onPointerMove={isTop ? onPointerMove : undefined}
                onPointerUp={isTop ? onPointerUp : undefined}
                onPointerCancel={isTop ? onPointerUp : undefined}
              >
                <div className="lp-swipe-card-face">
                  <span className="lp-swipe-card-mark" aria-hidden="true">
                    <span className="lp-swipe-card-icon">
                      <Icon />
                    </span>
                    <span className="lp-swipe-card-num">{step.num}</span>
                  </span>
                  <h3>{lt(step.title, locale)}</h3>
                  <p>{lt(step.body, locale)}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DownArrow() {
  return (
    <svg width="36" height="48" viewBox="0 0 36 48" fill="none" aria-hidden="true">
      <path
        d="M18 4v34M7 27.5 18 40.5 29 27.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
