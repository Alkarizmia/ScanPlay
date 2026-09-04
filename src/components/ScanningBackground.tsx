/** GPU-friendly orbs: transform-only, clipped, no layout shift. */
export function ScanningBackground() {
  return (
    <div className="import-ambient scanning-bg" aria-hidden="true">
      <span className="import-ambient-orb import-ambient-orb--a" />
      <span className="import-ambient-orb import-ambient-orb--b" />
      <span className="import-ambient-orb import-ambient-orb--c" />
      <span className="import-ambient-sheen" />
    </div>
  );
}
