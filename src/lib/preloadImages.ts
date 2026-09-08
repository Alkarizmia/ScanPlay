const loaded = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function loadSrc(src: string): Promise<void> {
  if (loaded.has(src)) return Promise.resolve();
  const pending = inflight.get(src);
  if (pending) return pending;

  const task = new Promise<void>((resolve) => {
    const img = new Image();
    const finish = () => {
      loaded.add(src);
      inflight.delete(src);
      resolve();
    };
    img.onload = () => {
      if (typeof img.decode === 'function') {
        void img.decode().then(finish).catch(finish);
      } else {
        finish();
      }
    };
    img.onerror = finish;
    img.src = src;
  });

  inflight.set(src, task);
  return task;
}

/** Decode cartoon assets before paint so a 2×2 grid can appear together. */
export function preloadImages(srcs: string[]): Promise<void> {
  const unique = [...new Set(srcs.filter(Boolean))];
  if (unique.length === 0) return Promise.resolve();
  return Promise.all(unique.map(loadSrc)).then(() => undefined);
}
