import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'eu-north-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'story-telling-bucket-s3';

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async uploadFile(file: Express.Multer.File, folder = 'avatars'): Promise<{ url: string; key: string }> {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    const fileExtension = file.originalname ? file.originalname.split('.').pop() : 'jpg';
    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'image/jpeg',
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      this.logger.log(`File uploaded successfully to S3: ${url}`);

      return { url, key };
    } catch (error: any) {
      this.logger.error(`Failed to upload file to S3: ${error.message}`, error.stack);
      throw new BadRequestException(`Image upload failed: ${error.message}`);
    }
  }

  async uploadBase64(base64Data: string, folder = 'avatars'): Promise<{ url: string; key: string }> {
    if (!base64Data) {
      throw new BadRequestException('No base64 data provided');
    }

    const matches = base64Data.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    let mimeType = 'image/jpeg';
    let buffer: Buffer;
    let fileExtension = 'jpg';

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      fileExtension = mimeType.split('/')[1] || 'jpg';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(base64Data, 'base64');
    }

    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      this.logger.log(`Base64 image uploaded successfully to S3: ${url}`);

      return { url, key };
    } catch (error: any) {
      this.logger.error(`Failed to upload base64 image to S3: ${error.message}`, error.stack);
      throw new BadRequestException(`Base64 image upload failed: ${error.message}`);
    }
  }
}
