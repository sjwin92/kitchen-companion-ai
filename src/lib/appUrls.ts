export function appUrl(path: string, origin = window.location.origin, basePath = import.meta.env.BASE_URL) {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const normalizedPath = path.replace(/^\//, '');
  return new URL(`${normalizedBase}${normalizedPath}`, origin).toString();
}
