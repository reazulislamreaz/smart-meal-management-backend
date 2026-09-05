import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/database/prisma.service";
import { UsersService } from "@/modules/users/users.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import * as argon2 from "argon2";
import * as crypto from "crypto";
import { Role } from "@prisma/client";

import { MailService } from "@/modules/mail/mail.service";
import { IpLocationService } from "@/common/services/ip-location.service";
import { Request } from "express";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly ipLocationService: IpLocationService,
  ) {}

  private hashTokenWithHmac(token: string): string {
    const secret =
      this.configService.get<string>("HMAC_SESSION_SECRET") ||
      "super_secret_hmac_key_for_refresh_sessions";
    return crypto.createHmac("sha256", secret).update(token).digest("hex");
  }

  async detectLocation(req?: Request) {
    return this.ipLocationService.resolveLocation(req);
  }

  async register(dto: RegisterDto, req?: Request) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("User with this email already exists");
    }

    const detectedLocation = await this.ipLocationService.resolveLocation(req);

    const passwordHash = await argon2.hash(dto.password);
    const avatarUrl = dto.image || null;
    const phoneNumber = dto.phone || null;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.fullName.trim(),
        avatarUrl,
        phoneNumber,
        role: Role.USER,
        weeklyBudget: 150.0,
        country: detectedLocation.country,
        city: detectedLocation.city,
        currency: detectedLocation.currency,
      },
    });

    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: "USER_REGISTERED",
          entity: "User",
          entityId: user.id,
          details: {
            email: user.email,
            name: user.name,
            country: user.country,
            city: user.city,
          },
          ipAddress: req?.ip || "127.0.0.1",
        },
      })
      .catch(() => null);

    const { passwordHash: _, ...sanitizedUser } = user;
    return {
      user: sanitizedUser,
      detectedLocation,
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.usersService.findByEmailInternal(dto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.isBlocked) {
      throw new UnauthorizedException(
        "Your account has been blocked by an administrator. Please contact support.",
      );
    }

    const isValidPassword = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isValidPassword) {
      throw new UnauthorizedException("Invalid email or password");
    }

    await this.prisma.auditLog
      .create({
        data: {
          userId: user.id,
          action: user.role === Role.SUPER_ADMIN ? "ADMIN_LOGIN" : "USER_LOGIN",
          entity: "Auth",
          entityId: user.id,
          details: {
            email: user.email,
            role: user.role,
            userAgent: userAgent || "Browser",
          },
          ipAddress: ipAddress || "127.0.0.1",
        },
      })
      .catch(() => null);

    const tokenPair = await this.generateTokenPair(
      user.id,
      user.email,
      user.role,
      ipAddress,
      userAgent,
    );

    const { passwordHash: _, ...sanitizedUser } = user;
    return {
      ...tokenPair,
      user: sanitizedUser,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isBlocked) {
      throw new UnauthorizedException(
        "Your account has been blocked by an administrator. Please contact support.",
      );
    }

    const { passwordHash: _, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  async generateTokenPair(
    userId: string,
    email: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>("JWT_SECRET") ||
        "super_secret_jwt_access_key_change_in_production_32bytes_min",
      expiresIn: (this.configService.get<string>("JWT_ACCESS_EXPIRATION") ||
        "15m") as any,
    });

    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const refreshTokenHash = this.hashTokenWithHmac(rawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.authSession.create({
      data: {
        userId,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: "Bearer",
      expiresIn: 900,
    };
  }

  async refreshTokenPair(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const refreshTokenHash = this.hashTokenWithHmac(rawRefreshToken);

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException("Invalid or revoked refresh token");
    }

    if (session.user?.isBlocked) {
      throw new UnauthorizedException(
        "Your account has been blocked by an administrator. Please contact support.",
      );
    }

    if (session.isRevoked || session.expiresAt < new Date()) {
      await this.prisma.authSession.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true },
      });
      throw new ForbiddenException(
        "Refresh token is expired or revoked. Please log in again.",
      );
    }

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    return this.generateTokenPair(
      session.user.id,
      session.user.email,
      session.user.role,
      ipAddress,
      userAgent,
    );
  }

  async logout(rawRefreshToken: string) {
    const refreshTokenHash = this.hashTokenWithHmac(rawRefreshToken);
    await this.prisma.authSession.updateMany({
      where: { refreshTokenHash },
      data: { isRevoked: true },
    });
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        message:
          "If an account exists with that email, a 6-digit OTP code has been sent.",
      };
    }

    const resetCode = crypto.randomInt(100000, 1000000).toString();
    const hashedResetToken = this.hashTokenWithHmac(resetCode);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: expiresAt,
      },
    });

    const displayName = user.name || "User";
    await this.mailService.sendPasswordResetEmail(
      user.email,
      resetCode,
      displayName,
    );

    return {
      message:
        "If an account exists with that email, a 6-digit OTP code has been sent.",
    };
  }

  async verifyOtp(email: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or verification code.");
    }

    const hashedCode = this.hashTokenWithHmac(code);

    if (
      !user.passwordResetToken ||
      user.passwordResetToken !== hashedCode ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new UnauthorizedException(
        "Invalid or expired 6-digit verification code.",
      );
    }

    return {
      message: "OTP verified successfully. You can now reset your password.",
    };
  }

  async resendOtp(email: string) {
    return this.forgotPassword(email);
  }

  async resetPassword(dto: {
    email: string;
    newPassword: string;
    confirmNewPassword: string;
  }) {
    const { email, newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException(
        "New password and confirm password do not match.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !user.passwordResetExpires ||
      user.passwordResetExpires < new Date()
    ) {
      throw new UnauthorizedException(
        "Invalid or expired password reset session. Please request a new OTP code.",
      );
    }

    const newPasswordHash = await argon2.hash(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    await this.prisma.authSession.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    return {
      message:
        "Password has been reset successfully. Please log in with your new password.",
    };
  }
}
