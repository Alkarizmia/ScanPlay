import { useEffect, useRef, useState } from 'react';

import { getMascotAssetFallbackUrl, getMascotAssetUrl } from '../../lib/mascot/catalog';
import type { MascotExpression } from '../../lib/mascot/types';
import { ScanPlayMascotSvg } from './svg/ScanPlayMascotSvg';

export interface MascotRendererProps {
  expression?: MascotExpression | string;
  size?: number;
  idle?: boolean;
  celebrate?: boolean;
  level?: number;
  className?: string;
  label?: string;
  /** Prefer raster asset when available in /public/mascot/emotions/ */
  preferAsset?: boolean;
}

/** Expressions that should feel “gamey” — hop + FX burst even on PNG assets. */
const REACTIVE_EXPRESSIONS = new Set<string>([
  'streak',
  'celebrating',
  'levelup',
  'combo',
  'chest',
  'badge',
  'excited',
  'jumping',
  'applauding',
  'happy',
  'welcome',
  'welcomed_back',
]);

/** Reaction poses to warm the cache (correct → happy, wrong → encouraging.webp). */
const REACTION_PRELOAD: MascotExpression[] = [
  'happy',
  'wrong',
  'excited',
  'combo',
  'levelup',
  'streak',
  'chest',
  'badge',
  'applauding',
  'celebrating',
  'welcome',
  'welcomed_back',
];

/** URLs already decoded once — lets repeat renders skip the fade-in. */
const loadedAssets = new Set<string>();

let preloadStarted = false;

function preloadMascotReactionAssets(): void {
  if (typeof window === 'undefined' || preloadStarted) return;
  preloadStarted = true;
  for (const expr of REACTION_PRELOAD) {
    const url = getMascotAssetUrl(expr);
    if (!url || loadedAssets.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      loadedAssets.add(url);
    };
    img.src = url;
  }
}

/**
 * Test override: `?mascot=svg` forces the anatomical SVG (idle animation path)
 * without changing production default preferAsset=true.
 */
function resolvePreferAsset(preferAsset: boolean): boolean {
  if (typeof window === 'undefined') return preferAsset;
  try {
    if (new URLSearchParams(window.location.search).get('mascot') === 'svg') return false;
  } catch {
    /* ignore */
  }
  return preferAsset;
}

const CROSSFADE_MS = 100;

/**
 * Renders the official mascot: high-res asset when present, else crisp inline SVG fallback.
 * The asset is rendered straight away so the SVG never flashes on slow connections;
 * it only takes over if the image genuinely fails to load.
 */
export function MascotRenderer({
  expression = 'happy',
  size = 72,
  idle = true,
  celebrate = false,
  level = 1,
  className = '',
  label = 'ScanPlay',
  preferAsset = true,
}: MascotRendererProps) {
  const useAsset = resolvePreferAsset(preferAsset);
  const expr = expression as MascotExpression;
  const assetUrl = useAsset ? getMascotAssetUrl(expr) : null;
  const fallbackUrl = useAsset ? getMascotAssetFallbackUrl(expr) : null;
  const reactive = celebrate || REACTIVE_EXPRESSIONS.has(expr);

  const [src, setSrc] = useState(assetUrl);
  const [outgoingSrc, setOutgoingSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(() => (assetUrl ? loadedAssets.has(assetUrl) : false));
  const srcRef = useRef(src);
  const fadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    srcRef.current = src;
  }, [src]);

  useEffect(() => {
    preloadMascotReactionAssets();
  }, []);

  useEffect(() => {
    if (fadeTimerRef.current != null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    if (!assetUrl) {
      setSrc(null);
      setOutgoingSrc(null);
      setFailed(false);
      setLoaded(false);
      return;
    }

    const prev = srcRef.current;
    if (assetUrl === prev) {
      setFailed(false);
      setLoaded(loadedAssets.has(assetUrl));
      return;
    }

    let cancelled = false;

    const commit = (next: string) => {
      if (cancelled) return;
      if (prev && prev !== next) {
        setOutgoingSrc(prev);
        fadeTimerRef.current = window.setTimeout(() => {
          if (!cancelled) setOutgoingSrc(null);
          fadeTimerRef.current = null;
        }, CROSSFADE_MS);
      }
      setSrc(next);
      setFailed(false);
      setLoaded(true);
      loadedAssets.add(next);
    };

    if (!prev || loadedAssets.has(assetUrl)) {
      commit(assetUrl);
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => commit(assetUrl);
    img.onerror = () => {
      if (cancelled) return;
      if (fallbackUrl && fallbackUrl !== assetUrl) {
        const fb = new Image();
        fb.onload = () => commit(fallbackUrl);
        fb.onerror = () => {
          if (!cancelled) setFailed(true);
        };
        fb.src = fallbackUrl;
        return;
      }
      setFailed(true);
    };
    img.src = assetUrl;

    return () => {
      cancelled = true;
    };
  }, [assetUrl, fallbackUrl]);

  useEffect(
    () => () => {
      if (fadeTimerRef.current != null) window.clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  const cls = [
    'scanplay-mascot',
    `scanplay-mascot--${expr}`,
    idle ? 'scanplay-mascot--idle' : '',
    celebrate ? 'scanplay-mascot--celebrate' : '',
    reactive ? 'scanplay-mascot--reactive' : '',
    !failed && src ? 'scanplay-mascot--asset' : 'scanplay-mascot--svg',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const fx =
    reactive || celebrate ? (
      <span className="sp-mascot-fx" aria-hidden="true">
        <i className="sp-fx-ring" />
        <i className="sp-fx-p sp-fx-p--1" />
        <i className="sp-fx-p sp-fx-p--2" />
        <i className="sp-fx-p sp-fx-p--3" />
        <i className="sp-fx-p sp-fx-p--4" />
        <i className="sp-fx-p sp-fx-p--5" />
        <i className="sp-fx-p sp-fx-p--6" />
      </span>
    ) : null;

  if (!failed && src) {
    return (
      <div className={cls} style={{ width: size, height: size * 1.1 }} aria-hidden={!label}>
        {fx}
        {outgoingSrc ? (
          <img
            key={`out-${outgoingSrc}`}
            src={outgoingSrc}
            alt=""
            className="sp-mascot-asset-img is-loaded sp-mascot-asset-img--out"
            width={size}
            height={Math.round(size * 1.1)}
            draggable={false}
            aria-hidden="true"
          />
        ) : null}
        <img
          key={`in-${src}`}
          src={src}
          alt={label}
          className={`sp-mascot-asset-img${loaded ? ' is-loaded' : ''}${outgoingSrc ? ' sp-mascot-asset-img--in' : ''}`}
          width={size}
          height={Math.round(size * 1.1)}
          draggable={false}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          onLoad={() => {
            loadedAssets.add(src);
            setLoaded(true);
          }}
          onError={() => {
            if (fallbackUrl && src !== fallbackUrl) {
              setSrc(fallbackUrl);
              return;
            }
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <ScanPlayMascotSvg
      expression={expr}
      size={size}
      idle={idle}
      celebrate={celebrate}
      level={level}
      className={className}
      label={label}
    />
  );
}

/** @deprecated alias */
export const ScanPlayMascot = MascotRenderer;
