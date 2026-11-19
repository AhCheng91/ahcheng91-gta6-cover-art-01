// Export: the canvas is already the finished cover at full resolution, so a PNG blob is the whole job.

/** Encodes the cover canvas to a PNG and returns { blob, url, name, width, height }. */
export function exportCover(canvas, state) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The canvas could not be encoded as PNG'));
        return;
      }
      const existing = state?.lastExport;
      if (existing?.url) URL.revokeObjectURL(existing.url);
      resolve({
        blob,
        url: URL.createObjectURL(blob),
        name: `vice-grid-${canvas.width}x${canvas.height}.png`,
        width: canvas.width,
        height: canvas.height,
        bytes: blob.size,
      });
    }, 'image/png');
  });
}

/** Triggers the download of an exported PNG through a temporary link. */
export function downloadExport(result) {
  const link = document.createElement('a');
  link.href = result.url;
  link.download = result.name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Human-readable byte size for the export card and result sheet. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
