import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SendMailJobData } from './mail.processor';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@InjectQueue('mail-queue') private readonly mailQueue: Queue) {}

  async sendMail(data: SendMailJobData): Promise<void> {
    this.logger.log(`Enqueuing mail job to ${data.to}`);
    await this.mailQueue.add('send-email', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Welcome to Smart Meal Management!',
      html: `<h1>Welcome, ${name}!</h1><p>Thank you for registering with Smart Meal Management System.</p>`,
    });
  }
}
