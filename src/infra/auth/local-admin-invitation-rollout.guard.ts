import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Second independent opt-in for the HTTP admin flow.
 * The mail adapter has its own SWIMFLOW_LOCAL_INVITES_ENABLED gate.
 * Neither flag is configured by default or in Render Blueprint.
 */
@Injectable()
export class LocalAdminInvitationRolloutGuard implements CanActivate {
  canActivate(): boolean {
    if (
      process.env.SWIMFLOW_LOCAL_INVITATION_API_ENABLED !== 'true' ||
      process.env.SWIMFLOW_LOCAL_INVITES_ENABLED !== 'true'
    ) {
      throw new ServiceUnavailableException(
        'Local administrative invitations are not enabled',
      );
    }

    return true;
  }
}
