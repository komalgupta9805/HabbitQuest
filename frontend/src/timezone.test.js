import { describe, expect, it } from 'vitest';
import { browserTimeZone } from './timezone';

describe('browser time zone header value', () => {
  it('keeps a valid browser IANA zone', () => {
    expect(browserTimeZone({ DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'Asia/Kolkata' }) }) })).toBe('Asia/Kolkata');
  });

  it('omits an empty or unavailable browser zone', () => {
    expect(browserTimeZone({ DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: ' ' }) }) })).toBeNull();
    expect(browserTimeZone(null)).toBeNull();
  });
});
