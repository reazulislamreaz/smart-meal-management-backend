import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { Public } from '@/common/decorators/public.decorator';

class Base64UploadDto {
  image!: string;
}

@ApiTags('Uploads')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Public()
  @Post('image')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload image file to AWS S3' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload (JPEG, PNG, WEBP, etc.)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Image uploaded successfully to S3' })
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Please attach an image file in the "file" field.');
    }
    const result = await this.uploadService.uploadFile(file);
    return {
      message: 'Image uploaded successfully to S3',
      data: result,
    };
  }

  @Public()
  @Post('base64')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload base64 image string to AWS S3' })
  @ApiResponse({ status: 200, description: 'Base64 image uploaded successfully to S3' })
  async uploadBase64Image(@Body() dto: Base64UploadDto) {
    if (!dto || !dto.image) {
      throw new BadRequestException('Please provide base64 image string in "image" field.');
    }
    const result = await this.uploadService.uploadBase64(dto.image);
    return {
      message: 'Image uploaded successfully to S3',
      data: result,
    };
  }
}
