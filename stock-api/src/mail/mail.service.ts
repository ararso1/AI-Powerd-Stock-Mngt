import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { buildPasswordResetEmail } from './password-reset.email';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('mail.host')?.trim();
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.port') ?? 587,
        secure: this.config.get<boolean>('mail.secure') ?? false,
        auth: {
          user: this.config.get<string>('mail.user') ?? '',
          pass: this.config.get<string>('mail.pass') ?? '',
        },
      });
    } else {
      this.logger.warn(
        'SMTP_HOST is not set — password reset emails will be logged to the console only',
      );
    }
  }

  async sendPasswordReset(to: string, fullName: string, resetUrl: string) {
    const from = this.config.get<string>('mail.from') ?? 'noreply@localhost';
    const minutes =
      this.config.get<number>('mail.passwordResetExpiresMinutes') ?? 60;
    const { subject, text, html } = buildPasswordResetEmail({
      fullName,
      resetUrl,
      minutes,
    });

    if (!this.transporter) {
      this.logger.log(`[dev] Password reset for ${to}: ${resetUrl}`);
      return { delivered: false, logged: true };
    }

    await this.transporter.sendMail({ from, to, subject, text, html });
    return { delivered: true, logged: false };
  }
}
