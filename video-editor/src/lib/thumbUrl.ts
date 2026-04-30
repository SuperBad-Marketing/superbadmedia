export function thumbUrl(path: string): string {
  if (path.startsWith('/thumbnails/')) return path
  const file = path.split('/').pop()
  return file ? `/thumbnails/${file}` : path
}
