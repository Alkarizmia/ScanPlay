/** Lightweight CSS-only animated background for loading (mobile-safe) */
export function ScanningBackground() {
  return (
    <div className="scanning-bg" aria-hidden="true">
      <span className="scanning-orb scanning-orb-a" />
      <span className="scanning-orb scanning-orb-b" />
      <span className="scanning-orb scanning-orb-c" />
    </div>
  );
}
