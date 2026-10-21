export function browserTimeZone(intl = globalThis.Intl) {
  try {
    const zone = intl?.DateTimeFormat?.().resolvedOptions().timeZone;
    return typeof zone === 'string' && zone.trim() ? zone.trim() : null;
  } catch {
    return null;
  }
}
