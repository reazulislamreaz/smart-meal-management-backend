import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register end user with automatic IP-based location detection' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const result = await this.authService.register(registerDto, req);
    return {
      message: 'User registered successfully',
      data: result,
    };
  }

  @Public()
  @Get('detect-location')
  @ApiOperation({ summary: 'Auto-detect client country and city from IP (Defaults to United Kingdom)' })
  @ApiResponse({ status: 200, description: 'Location resolved successfully' })
  async detectLocation(@Req() req: Request) {
    const location = await this.authService.detectLocation(req);
    return {
      message: 'Client location detected successfully',
      data: location,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user & issue access/refresh tokens' })
  @ApiHeader({ name: 'user-agent', required: false, description: 'Browser or client software info' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await this.authService.login(loginDto, ipAddress, userAgent);
    return {
      message: 'Login successful',
      data: result,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new token pair' })
  @ApiHeader({ name: 'user-agent', required: false, description: 'Browser or client software info' })
  @ApiResponse({ status: 200, description: 'Token pair refreshed successfully' })
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await this.authService.refreshTokenPair(
      refreshTokenDto.refreshToken,
      ipAddress,
      userAgent,
    );
    return {
      message: 'Tokens refreshed successfully',
      data: result,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active refresh session' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    await this.authService.logout(refreshTokenDto.refreshToken);
    return {
      message: 'Logout successful',
      data: null,
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Screen 1: Request 6-digit OTP code to reset password' })
  @ApiResponse({ status: 200, description: '6-digit OTP code sent if account exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(forgotPasswordDto.email);
    return {
      message: result.message,
      data: null,
    };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Screen 2: Verify 6-digit OTP code' })
  @ApiResponse({ status: 200, description: 'OTP code verified successfully' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(verifyOtpDto.email, verifyOtpDto.code);
    return {
      message: result.message,
      data: null,
    };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Screen 2: Resend 6-digit OTP code' })
  @ApiResponse({ status: 200, description: 'OTP code resent successfully' })
  async resendOtp(@Body() resendOtpDto: ResendOtpDto) {
    const result = await this.authService.resendOtp(resendOtpDto.email);
    return {
      message: result.message,
      data: null,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Screen 3: Reset password using verified 6-digit OTP code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const result = await this.authService.resetPassword(resetPasswordDto);
    return {
      message: result.message,
      data: null,
    };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile and preferences' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  async getProfile(@CurrentUser('id') userId: string) {
    const user = await this.authService.getProfile(userId);
    return {
      message: 'Profile retrieved successfully',
      data: user,
    };
  }
}
