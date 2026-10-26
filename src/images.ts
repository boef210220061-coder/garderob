export async function compressPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw Error('Выберите фотографию');
  if (file.size > 25 * 1024 * 1024) throw Error('Фото должно быть меньше 25 МБ');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw Error('Браузер не смог обработать фото');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.84);
  } catch {
    throw Error('Не удалось открыть фото. Попробуйте JPEG, PNG или WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
