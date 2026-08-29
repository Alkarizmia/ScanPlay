const IMAGE_NAME = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tif{1,2})$/i;
const MAX_WALK_ENTRIES = 120;
const MAX_FOLDER_DEPTH = 4;

export function isLikelyImageFile(file: File): boolean {
  if (file.type.toLowerCase().startsWith('image/')) return true;
  return IMAGE_NAME.test(file.name);
}

function readAllDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const pump = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(all);
          return;
        }
        all.push(...batch);
        pump();
      }, reject);
    };
    pump();
  });
}

function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  out: File[],
  depth: number,
  budget: { left: number },
): Promise<void> {
  if (budget.left <= 0) return;

  if (entry.isFile) {
    budget.left -= 1;
    try {
      const file = await fileFromEntry(entry as FileSystemFileEntry);
      if (isLikelyImageFile(file)) out.push(file);
    } catch {
      /* unreadable entry */
    }
    return;
  }

  if (!entry.isDirectory || depth >= MAX_FOLDER_DEPTH) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children = await readAllDirectoryEntries(reader);
  for (const child of children) {
    if (budget.left <= 0) break;
    await walkEntry(child, out, depth + 1, budget);
  }
}

/** Collect image files from a drop, including images inside a dragged folder. */
export async function collectDroppedImageFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const filesSnapshot = Array.from(dataTransfer.files);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry != null);

  if (entries.length) {
    const fromEntries: File[] = [];
    const budget = { left: MAX_WALK_ENTRIES };
    for (const entry of entries) {
      await walkEntry(entry, fromEntries, 0, budget);
    }
    if (fromEntries.length) return fromEntries;
  }

  return filesSnapshot.filter(isLikelyImageFile);
}
