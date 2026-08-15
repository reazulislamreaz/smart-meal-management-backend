import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listStaticPages() {
    return this.prisma.staticPage.findMany({
      orderBy: { slug: 'asc' },
    });
  }

  async getStaticPage(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!page) {
      if (slug === 'privacy-policy') {
        return {
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          content:
            'Smart Meal Management is committed to protecting your family privacy and personal dietary data.',
          updatedAt: new Date(),
        };
      }
      if (slug === 'about-us') {
        return {
          slug: 'about-us',
          title: 'About Sizzl / PlatePlan',
          content:
            'Sizzl is an AI-powered family meal planning and pantry inventory platform engineered to end food waste and financial friction.',
          updatedAt: new Date(),
        };
      }
      throw new NotFoundException(`Static page "${slug}" not found`);
    }

    return page;
  }

  async createStaticPage(slug: string, title: string, content: string) {
    const existing = await this.prisma.staticPage.findUnique({
      where: { slug: slug.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException(`Static page with slug "${slug}" already exists`);
    }

    return this.prisma.staticPage.create({
      data: {
        slug: slug.toLowerCase(),
        title,
        content,
      },
    });
  }

  async updateStaticPage(slug: string, title: string, content: string) {
    return this.prisma.staticPage.upsert({
      where: { slug: slug.toLowerCase() },
      update: { title, content },
      create: { slug: slug.toLowerCase(), title, content },
    });
  }

  async deleteStaticPage(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug: slug.toLowerCase() },
    });
    if (!page) {
      throw new NotFoundException(`Static page "${slug}" not found`);
    }

    await this.prisma.staticPage.delete({ where: { slug: slug.toLowerCase() } });
    return { success: true, message: `Static page "${slug}" deleted successfully` };
  }

  async submitContactForm(dto: { name: string; email: string; message: string; subject?: string }) {
    const contactMessage = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject || 'General Inquiry',
        message: dto.message,
        status: 'UNREAD',
      },
    });

    return {
      success: true,
      message: 'Thank you for reaching out! Our support team will respond shortly.',
      data: contactMessage,
    };
  }
}
