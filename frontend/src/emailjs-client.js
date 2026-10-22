import emailjs from '@emailjs/browser';

export function safeEmailJsResponseText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\r\n\t]+/g, ' ')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_-]{24,}\b/g, '[redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .trim().slice(0, 180);
}

export function emailJsFailure(cause) {
  const status = Number(cause?.status);
  const responseText = safeEmailJsResponseText(cause?.text);
  if (!Number.isInteger(status) || status <= 0) {
    return new Error('Could not reach EmailJS. Check your connection and try again.');
  }
  if (status === 412 && /Gmail_API:\s*Request had insufficient authentication scopes\.?/i.test(cause?.text || '')) {
    return new Error('EmailJS could not send through its connected Gmail account (HTTP 412): Gmail sending permission was not granted. Reconnect the Gmail service in EmailJS and approve its requested send permission.');
  }
  const detail = status === 400 ? 'Check the EmailJS request and connected service.'
    : status === 401 || status === 403 ? 'Check the EmailJS public key and allowed domains.'
    : status === 404 ? 'Check the EmailJS service and template IDs.'
    : status === 412 ? 'An EmailJS precondition was not met. Use the provider response to identify the required dashboard change.'
    : status === 422 ? 'Check the template To Email field. Use {{email}} or {{to_email}}, save the template, then test again.'
    : status === 429 ? 'EmailJS rate limit reached. Wait before testing again.'
    : status >= 500 ? 'EmailJS or the connected email service is unavailable. Try again later.'
    : 'Check the EmailJS dashboard and the provider response.';
  return new Error(`EmailJS rejected the request (HTTP ${status}). ${detail}${status === 412 && responseText ? ` Provider response: ${responseText}` : ''}`);
}

export const emailConfig = {
  publicKey: (import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '').trim(),
  serviceId: (import.meta.env.VITE_EMAILJS_SERVICE_ID || '').trim(),
  templateId: (import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '').trim(),
  appUrl: (import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).trim(),
};

export function emailConfigError(config = emailConfig) {
  if (!config.publicKey || config.publicKey === 'YOUR_PUBLIC_KEY' || !config.serviceId || !config.templateId) {
    return 'EmailJS is not configured. Add your public key, service ID, and template ID to frontend/.env, then restart Vite.';
  }
  return '';
}

export function emailTemplateParams(notification, user, config = emailConfig) {
  if (!user?.email?.trim()) throw new Error('Your account has no registered email address. Sign in with an account that has an email address.');
  return {
    to_email: user.email.trim(),
    email: user.email.trim(),
    to_name: user.name?.trim() || 'friend',
    subject: notification.title,
    message: notification.message,
    habit_name: notification.habit_name || 'your little wins',
    notification_type: notification.kind,
    app_url: config.appUrl,
  };
}

export async function sendNotificationEmail(notification, user, config = emailConfig) {
  const error = emailConfigError(config);
  if (error) throw new Error(error);
  const params = emailTemplateParams(notification, user, config);
  try {
    return await emailjs.send(config.serviceId, config.templateId, params, { publicKey: config.publicKey });
  } catch (cause) {
    if (import.meta.env.DEV) console.warn('EmailJS send failed', {
      status: Number(cause?.status) || 0,
      responseText: safeEmailJsResponseText(cause?.text),
      serviceId: config.serviceId,
      templateId: config.templateId,
      parameterNames: Object.keys(params),
      recipientPresent: Boolean(params.email),
    });
    throw emailJsFailure(cause);
  }
}
