import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { AppConfig } from '../../config/configuration.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Envio de e-mail via SMTP.
 *
 * Em desenvolvimento o docker-compose sobe o Mailpit, que aceita qualquer
 * mensagem e mostra tudo numa caixa de entrada web. Sem `SMTP_HOST` o envio é
 * desligado e o conteúdo vai para o log, para a API rodar sem dependências.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService<AppConfig, true>) {
    const mail = config.get('mail', { infer: true });
    this.from = mail.from;
    this.transporter = mail.host
      ? createTransport({
          host: mail.host,
          port: mail.port,
          secure: mail.port === 465,
          auth: mail.user ? { user: mail.user, pass: mail.password ?? '' } : undefined,
        })
      : null;
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`E-mail não enviado (SMTP desligado) para ${message.to}: ${message.text}`);
      return;
    }

    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
