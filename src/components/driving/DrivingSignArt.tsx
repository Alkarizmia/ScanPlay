import { resolveDrivingSignId } from '../../lib/drivingSignAliases';
import { drivingSignSrc as catalogSrc } from '../../lib/drivingSignsCatalog';

/** Resolve PNG path for a Belgian sign id (official code or legacy slug). */
export function drivingSignSrc(id: string): string | undefined {
  const code = resolveDrivingSignId(id);
  return catalogSrc(code) ?? `/universe/signs/${code}.png`;
}

export function DrivingSignArt({ id, className = '' }: { id: string; className?: string }) {
  const code = resolveDrivingSignId(id);
  const src = drivingSignSrc(id);
  return (
    <div className={`driving-sign-art ${className}`.trim()} data-sign={code}>
      {src ? (
        <img src={src} alt="" className="driving-sign-img" draggable={false} />
      ) : (
        <div className="driving-sign-missing" aria-hidden="true">
          ?
        </div>
      )}
    </div>
  );
}
