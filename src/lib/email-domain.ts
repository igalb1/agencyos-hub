const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com','googlemail.com','outlook.com','hotmail.com','live.com','msn.com',
  'yahoo.com','yahoo.co.uk','yahoo.co.il','ymail.com','rocketmail.com',
  'icloud.com','me.com','mac.com','aol.com','aim.com',
  'proton.me','protonmail.com','pm.me',
  'gmx.com','gmx.de','gmx.net','mail.com','zoho.com','yandex.com','yandex.ru',
  'walla.com','walla.co.il','nana10.co.il','012.net.il','bezeqint.net',
]);

export function getEmailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? '';
}

export function isPublicEmailDomain(email: string): boolean {
  const d = getEmailDomain(email);
  if (!d) return false;
  return PUBLIC_EMAIL_DOMAINS.has(d);
}
