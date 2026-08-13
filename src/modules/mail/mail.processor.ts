import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface SendMailJobData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    super();
    const user =
      this.configService.get<string>('APP_USER_EMAIL') ||
      this.configService.get<string>('SMTP_USER') ||
      '';
    const pass =
      this.configService.get<string>('APP_PASSWORD') ||
      this.configService.get<string>('SMTP_PASS') ||
      '';

    const isGmail = user.toLowerCase().includes('@gmail.com');

    if (isGmail) {
      this.logger.log(`Initializing Gmail Nodemailer transport for: ${user}`);
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      });
    } else {
      const host = this.configService.get<string>('SMTP_HOST') || 'smtp.mailtrap.io';
      const port = Number(this.configService.get<number>('SMTP_PORT')) || 2525;
      const secure = port === 465;

      this.logger.log(`Initializing SMTP transport for ${host}:${port}`);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    }
  }

  async process(job: Job<SendMailJobData>): Promise<any> {
    this.logger.log(`Processing email job ${job.id} to ${job.data.to}...`);

    try {
      const user =
        this.configService.get<string>('APP_USER_EMAIL') ||
        this.configService.get<string>('SMTP_USER') ||
        '';

      const from =
        this.configService.get<string>('EMAIL_FROM') ||
        (user ? `"Smart Meal Management" <${user}>` : '"Smart Meal Management" <no-reply@smartmeal.com>');

      const info = await this.transporter.sendMail({
        from,
        to: job.data.to,
        subject: job.data.subject,
        text: job.data.text,
        html: job.data.html,
      });

      this.logger.log(`Email sent successfully to ${job.data.to}. MessageId: ${info.messageId}`);
      return { messageId: info.messageId };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${job.data.to}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
