function revokePrevious(state) {
  const prior = state && state.lastExport;
  if (prior && typeof prior.url === 'string' && prior.url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(prior.url);
    } catch (err) {
      void err;
    }
  }
}

export function exportCover(canvas, state) {
  if (!canvas) return Promise.reject(new Error('exportCover needs a canvas'));
  revokePrevious(state);
  const width = canvas.width;
  const height = canvas.height;

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export produced no blob'));
        return;
      }
      const url = URL.createObjectURL(blob);
      resolve({
        blob,
        url,
        name: 'solaris-vice-' + width + 'x' + height + '.png',
        width,
        height,
        bytes: blob.size
      });
    }, 'image/png');
  });
}
