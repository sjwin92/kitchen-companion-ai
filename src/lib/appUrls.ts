const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.trim().replace(/\/$/, '');

export function appUrl(path: string, origin = configuredOrigin || window.location.origin, basePath = import.meta.env.BASE_URL) {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const normalizedPath = path.replace(/^\//, '');
  return new URL(`${normalizedBase}${normalizedPath}`, origin).toString();
}
