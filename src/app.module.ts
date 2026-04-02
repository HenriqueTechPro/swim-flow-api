import { Module } from '@nestjs/common'
import { AuthModule } from '@/infra/auth/auth.module'
import { DatabaseModule } from '@/infra/database/database.module'
import { EnvModule } from '@/infra/env/env.module'
import { HttpModule } from '@/infra/http/http.module'
import { CryptographyModule } from '@/infra/cryptography/cryptography.module'
import { AppController } from './app.controller'

@Module({
  imports: [EnvModule, DatabaseModule, AuthModule, HttpModule, CryptographyModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
