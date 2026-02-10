import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthDto, Tokens } from './dto/auth.dto';
import { RtGuard } from './guards/rt.guard';
import { GetUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  signinLocal(@Body() dto: AuthDto): Promise<Tokens> {
    return this.authService.signinLocal(dto);
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  logout(@GetUser('sub') userId: string) {
    return this.authService.logout(userId);
  }

  @Public() // RT Guard xử lý token, nhưng endpoint này public về mặt AT
  @UseGuards(RtGuard)
  @Post('refresh')
  @ApiBearerAuth() // Swagger cần bearer token (nhưng là RT)
  @HttpCode(HttpStatus.OK)
  refreshTokens(
    @GetUser('sub') userId: string,
    @GetUser('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  getMe(@GetUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }
}