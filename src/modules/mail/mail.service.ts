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

  async sendPasswordResetEmail(to: string, code: string, name: string): Promise<void> {
    await this.sendMail({
      to,
      subject: 'Your 6-Digit Password Reset Code - Smart Meal Management',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #E5E7EB; border-radius: 8px; background-color: #FFFFFF;">
          <h2 style="color: #1E40AF; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #374151;">Hello <strong>${name}</strong>,</p>
          <p style="color: #4B5563;">You requested to reset your password for Smart Meal Management. Use the 6-digit verification code below:</p>
          <div style="background-color: #F3F4F6; border: 2px dashed #1E40AF; padding: 16px; font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #1E40AF; border-radius: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="color: #6B7280; font-size: 13px; margin-bottom: 0;">This 6-digit code is valid for 15 minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    });
  }
}
