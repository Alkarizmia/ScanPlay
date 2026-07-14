import { useEffect, useState } from 'react';

import { getMascotAssetUrl } from '../../lib/mascot/catalog';
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

/**
 * Renders the official mascot: high-res PNG asset when present, else crisp inline SVG fallback.
 * Assets are generated per expression and dropped into public/mascot/emotions/.
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
  const [useAsset, setUseAsset] = useState(false);

  useEffect(() => {
    if (!assetUrl) {
      setUseAsset(false);
      return;
    }
    const img = new Image();
    img.onload = () => setUseAsset(true);
    img.onerror = () => setUseAsset(false);
    img.src = assetUrl;
  }, [assetUrl]);

  const cls = [
    'scanplay-mascot',
    `scanplay-mascot--${expr}`,
    idle ? 'scanplay-mascot--idle' : '',
    celebrate ? 'scanplay-mascot--celebrate' : '',
    useAsset ? 'scanplay-mascot--asset' : 'scanplay-mascot--svg',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (useAsset && assetUrl) {
    return (
      <div className={cls} style={{ width: size, height: size * 1.1 }} aria-hidden={!label}>
        <img
          src={assetUrl}
          alt={label}
          className="sp-mascot-asset-img"
          width={size}
          height={Math.round(size * 1.1)}
          draggable={false}
          loading="lazy"
          decoding="async"
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
