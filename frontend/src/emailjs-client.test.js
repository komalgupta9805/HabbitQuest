import { describe, expect, it, vi } from 'vitest';
import emailjs from '@emailjs/browser';
import { emailConfigError, emailTemplateParams, safeEmailJsResponseText, sendNotificationEmail } from './emailjs-client';

vi.mock('@emailjs/browser', () => ({ default: { send: vi.fn() } }));
const config = { publicKey: 'test-public', serviceId: 'service_test', templateId: 'template_test', appUrl: 'https://example.test' };
const item = { kind: 'pending', title: 'A little win', message: 'Read for five minutes.', habit_name: 'Read' };
const user = { name: 'Ava', email: 'ava@example.test' };

describe('EmailJS client', () => {
  it('reports missing configuration without calling EmailJS', async () => {
    expect(emailConfigError({ ...config, publicKey: 'YOUR_PUBLIC_KEY' })).toMatch(/not configured/);
    await expect(sendNotificationEmail(item, user, { ...config, publicKey: '' })).rejects.toThrow(/not configured/);
    expect(emailjs.send).not.toHaveBeenCalled();
  });
  it('maps every template field and only the authenticated account email', async () => {
    expect(emailTemplateParams(item, user, config)).toEqual({ to_email: 'ava@example.test', email: 'ava@example.test', to_name: 'Ava', subject: 'A little win', message: 'Read for five minutes.', habit_name: 'Read', notification_type: 'pending', app_url: 'https://example.test' });
    expect(() => emailTemplateParams(item, { name: 'Ava' }, config)).toThrow(/registered email/);
    emailjs.send.mockResolvedValueOnce({ status: 200 });
    await expect(sendNotificationEmail(item, user, config)).resolves.toEqual({ status: 200 });
    expect(emailjs.send).toHaveBeenCalledWith('service_test', 'template_test', emailTemplateParams(item, user, config), { publicKey: 'test-public' });
  });
  it('reports the provider status without exposing provider details', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    emailjs.send.mockRejectedValueOnce(new Error('secret provider diagnostic'));
    await expect(sendNotificationEmail(item, user, config)).rejects.toThrow('Could not reach EmailJS.');
    emailjs.send.mockRejectedValueOnce({ status: 403, text: 'secret provider diagnostic' });
    await expect(sendNotificationEmail(item, user, config)).rejects.toThrow('EmailJS rejected the request (HTTP 403). Check the EmailJS public key and allowed domains.');
    emailjs.send.mockRejectedValueOnce({ status: 422, text: 'The recipient address is empty' });
    await expect(sendNotificationEmail(item, user, config)).rejects.toThrow('EmailJS rejected the request (HTTP 422). Check the template To Email field. Use {{email}} or {{to_email}}, save the template, then test again.');
    emailjs.send.mockRejectedValueOnce({ status: 412, text: 'Gmail_API: Invalid grant. Please reconnect your Gmail account' });
    await expect(sendNotificationEmail(item, user, config)).rejects.toThrow('EmailJS rejected the request (HTTP 412). An EmailJS precondition was not met. Use the provider response to identify the required dashboard change. Provider response: Gmail_API: Invalid grant. Please reconnect your Gmail account');
    emailjs.send.mockRejectedValueOnce({ status: 412, text: 'Gmail_API: Request had insufficient authentication scopes.' });
    await expect(sendNotificationEmail(item, user, config)).rejects.toThrow('EmailJS could not send through its connected Gmail account (HTTP 412): Gmail sending permission was not granted. Reconnect the Gmail service in EmailJS and approve its requested send permission.');
    expect(warning).toHaveBeenLastCalledWith('EmailJS send failed', expect.objectContaining({ status: 412, serviceId: 'service_test', templateId: 'template_test', recipientPresent: true }));
    warning.mockRestore();
  });
  it('redacts personal details and long tokens from provider text', () => {
    expect(safeEmailJsResponseText('Contact ava@example.test at https://example.test/secret with abcdefghijklmnopqrstuvwxyz123456')).toBe('Contact [email] at [link] with [redacted]');
  });
});
