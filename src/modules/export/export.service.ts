import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { UsersService } from '@/modules/users/users.service';

@Injectable()
export class ExportService {
  constructor(private readonly usersService: UsersService) {}

  async generateUsersExcelBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Users');

    worksheet.columns = [
      { header: 'User ID', key: 'id', width: 36 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'First Name', key: 'firstName', width: 20 },
      { header: 'Last Name', key: 'lastName', width: 20 },
      { header: 'Role', key: 'role', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 25 },
    ];

    const { data: users } = await this.usersService.findAll(1, 1000);

    users.forEach((user) => {
      worksheet.addRow({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      });
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async generateUsersPdfBuffer(): Promise<Buffer> {
    const { data: users } = await this.usersService.findAll(1, 1000);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // PDF Title
      doc.fontSize(18).text('Smart Meal Management System - Users Export', { align: 'center' });
      doc.moveDown(1.5);

      // Table Headers
      doc.fontSize(10).text('Email', 30, doc.y, { width: 180, continued: true });
      doc.text('Name', 210, doc.y, { width: 150, continued: true });
      doc.text('Role', 360, doc.y, { width: 100, continued: true });
      doc.text('Created At', 460, doc.y, { width: 100 });
      doc.moveDown(0.5);
      doc.moveTo(30, doc.y).lineTo(560, doc.y).stroke();
      doc.moveDown(0.5);

      // Rows
      users.forEach((user) => {
        const y = doc.y;
        if (y > 750) {
          doc.addPage();
        }
        doc.fontSize(9).text(user.email, 30, doc.y, { width: 180, continued: true });
        doc.text(`${user.firstName} ${user.lastName}`, 210, doc.y, { width: 150, continued: true });
        doc.text(user.role, 360, doc.y, { width: 100, continued: true });
        doc.text(new Date(user.createdAt).toLocaleDateString(), 460, doc.y, { width: 100 });
        doc.moveDown(0.3);
      });

      doc.end();
    });
  }
}
