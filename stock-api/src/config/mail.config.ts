import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.SMTP_HOST ?? '',
  port: parseInt(process.env.SMTP_PORT ?? '587', 10),
  secure: (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true',
  user: process.env.SMTP_USER ?? '',
  pass: process.env.SMTP_PASS ?? '',
  from: process.env.SMTP_FROM ?? 'noreply@efnanbusinessplc.com',
  frontendUrl: (
    process.env.FRONTEND_URL ?? 'http://localhost:3000'
  ).replace(/\/$/, ''),
  passwordResetExpiresMinutes: parseInt(
    process.env.PASSWORD_RESET_EXPIRES_MINUTES ?? '60',
    10,
  ),
}));
