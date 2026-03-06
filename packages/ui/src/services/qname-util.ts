export function buildPrefixedName(
  localPart: string,
  namespaceURI: string | null,
  namespaceMap: Record<string, string>,
): string {
  if (!namespaceURI) return localPart;
  const prefix = Object.entries(namespaceMap).find(([, uri]) => uri === namespaceURI)?.[0];
  return prefix ? `${prefix}:${localPart}` : localPart;
}

/**
 * Format a QName as `prefix:localPart` using the namespace map.
 * Falls back to the provided fallback string if the QName is null.
 */
export function formatQNameWithPrefix(
  qName: { getNamespaceURI: () => string; getLocalPart: () => string | null } | null | undefined,
  namespaceMap: Record<string, string>,
  fallback: string,
): string {
  if (!qName) return fallback;
  const nsURI = qName.getNamespaceURI();
  const localPart = qName.getLocalPart();
  if (!localPart) return fallback;
  const prefix = Object.entries(namespaceMap).find(([, uri]) => uri === nsURI)?.[0] || '';
  return prefix ? `${prefix}:${localPart}` : localPart;
}
