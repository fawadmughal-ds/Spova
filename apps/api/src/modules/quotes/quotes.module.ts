import { Global, Module } from '@nestjs/common';
import { QuotesService } from './quotes.service';

@Global()
@Module({
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
