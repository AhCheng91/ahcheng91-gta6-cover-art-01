export function exportCover(canvas, state) {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      reject(new Error('No canvas to export'));
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The canvas could not be encoded as PNG'));
        return;
      }
      const width = canvas.width;
      const height = canvas.height;
      const previous = state && state.lastExport;
      if (previous && previous.url) URL.revokeObjectURL(previous.url);
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        filename: `solaris-vice-${width}x${height}.png`,
        width,
        height,
        bytes: blob.size
      });
    }, 'image/png');
  });
}

export function downloadExport(result) {
  if (!result) return;
  const href = result.url || (result.blob ? URL.createObjectURL(result.blob) : '');
  if (!href) return;
  const link = document.createElement('a');
  link.href = href;
  link.download = result.filename || `solaris-vice-${result.width || 0}x${result.height || 0}.png`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
