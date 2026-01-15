import { Body, Controller, Inject, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { ConnectWalletDto } from './dtos/connect-wallet.dto';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post('wallet')
  connectWallet(@Body() body: ConnectWalletDto) {
    return this.authService.connectWallet(body);
  }
}
