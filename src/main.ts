import 'reflect-metadata';
import { env } from '@/infra/env/env';
import { createApp } from './app.factory';

async function bootstrap() {
  const app = await createApp();
  await app.listen(env.port, '0.0.0.0');
}
void bootstrap();
