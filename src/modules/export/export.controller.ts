import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Role } from '@prisma/client';

@ApiTags('Exports')
@ApiBearerAuth('bearer-auth')
@UseGuards(RolesGuard)
@Controller('exports')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('users/excel')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export users list as Excel spreadsheet (XLSX)' })
  async exportUsersExcel(@Res() res: Response) {
    const buffer = await this.exportService.generateUsersExcelBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="users-report.xlsx"');
    res.send(buffer);
  }

  @Get('users/pdf')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Export users list as PDF document' })
  async exportUsersPdf(@Res() res: Response) {
    const buffer = await this.exportService.generateUsersPdfBuffer();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="users-report.pdf"');
    res.send(buffer);
  }
}
