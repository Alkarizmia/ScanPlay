import { useEffect, useState } from 'react';

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

/** URLs already decoded once — lets repeat renders skip the fade-in. */
const loadedAssets = new Set<string>();

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
  const expr = expression as MascotExpression;
  const assetUrl = preferAsset ? getMascotAssetUrl(expr) : null;
  const fallbackUrl = preferAsset ? getMascotAssetFallbackUrl(expr) : null;
  const reactive = celebrate || REACTIVE_EXPRESSIONS.has(expr);

  const [src, setSrc] = useState(assetUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(() => (assetUrl ? loadedAssets.has(assetUrl) : false));

  useEffect(() => {
    setSrc(assetUrl);
    setFailed(false);
    setLoaded(assetUrl ? loadedAssets.has(assetUrl) : false);
  }, [assetUrl]);

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
        <img
          src={src}
          alt={label}
          className={`sp-mascot-asset-img${loaded ? ' is-loaded' : ''}`}
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
