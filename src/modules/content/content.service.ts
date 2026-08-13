import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async getStaticPage(slug: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { slug: slug.toLowerCase() },
    });

    if (!page) {
      // Fallback default content if not populated yet
      if (slug === 'privacy-policy') {
        return {
          slug: 'privacy-policy',
          title: 'Privacy Policy',
          content: 'Smart Meal Management is committed to protecting your family privacy and personal dietary data.',
          updatedAt: new Date(),
        };
      }
      if (slug === 'about-us') {
        return {
          slug: 'about-us',
          title: 'About Sizzl / PlatePlan',
          content: 'Sizzl is an AI-powered family meal planning and pantry inventory platform engineered to end food waste and financial friction.',
          updatedAt: new Date(),
        };
      }
      throw new NotFoundException(`Static page "${slug}" not found`);
    }

    return page;
  }

  async updateStaticPage(slug: string, title: string, content: string) {
    const page = await this.prisma.staticPage.upsert({
      where: { slug: slug.toLowerCase() },
      update: { title, content },
      create: { slug: slug.toLowerCase(), title, content },
    });

    return page;
  }

  async submitContactForm(dto: { name: string; email: string; message: string; subject?: string }) {
    // In production this emits an email to support or logs an audit ticket
    return {
      success: true,
      message: 'Thank you for reaching out! Our team will respond shortly.',
      received: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject || 'General Inquiry',
      },
    };
  }
}
