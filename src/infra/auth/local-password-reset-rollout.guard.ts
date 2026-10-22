import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class LocalPasswordResetRolloutGuard implements CanActivate {
  canActivate(): boolean {
    if (
      process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_API_ENABLED !== 'true' ||
      process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED !== 'true'
    ) {
      throw new ServiceUnavailableException(
        'Local password reset is not enabled',
      );
    }
    return true;
  }
}
