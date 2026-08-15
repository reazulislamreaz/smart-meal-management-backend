import { Module, Global } from '@nestjs/common';
import { IpLocationService } from './services/ip-location.service';

@Global()
@Module({
  providers: [IpLocationService],
  exports: [IpLocationService],
})
export class CommonModule {}
