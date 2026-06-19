export const PROFILE_AVATAR_MAX_INPUT_BYTES = 5 * 1024 * 1024;
const PROFILE_AVATAR_MAX_PX = 256;
const PROFILE_AVATAR_JPEG_QUALITY = 0.82;

function resizeImageToDataUrl(file: File, maxSize: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

export function createThumbnail(file: File, maxSize = 80): Promise<string> {
  return resizeImageToDataUrl(file, maxSize, 0.7);
}

/** Profile photo: accepts large files, stores a small optimized JPEG (~20–80 Ko). */
export function createProfileAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('not_image'));
  }
  if (file.size > PROFILE_AVATAR_MAX_INPUT_BYTES) {
    return Promise.reject(new Error('too_large'));
  }
  return resizeImageToDataUrl(file, PROFILE_AVATAR_MAX_PX, PROFILE_AVATAR_JPEG_QUALITY);
}
