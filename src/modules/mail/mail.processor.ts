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
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST') || 'smtp.mailtrap.io',
      port: Number(this.configService.get<number>('SMTP_PORT')) || 2525,
      auth: {
        user: this.configService.get<string>('SMTP_USER') || '',
        pass: this.configService.get<string>('SMTP_PASS') || '',
      },
    });
  }

  async process(job: Job<SendMailJobData>): Promise<any> {
    this.logger.log(`Processing email job ${job.id} to ${job.data.to}...`);

    try {
      const from =
        this.configService.get<string>('EMAIL_FROM') ||
        '"Smart Meal Management" <no-reply@smartmeal.com>';

      const info = await this.transporter.sendMail({
        from,
        to: job.data.to,
        subject: job.data.subject,
        text: job.data.text,
        html: job.data.html,
      });

      this.logger.log(`Email sent successfully: ${info.messageId}`);
      return { messageId: info.messageId };
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${job.data.to}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
