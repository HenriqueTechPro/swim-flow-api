import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AuthDirectoryRepository } from '@/domain/auth/application/repositories/auth-directory-repository';
import { EnvService } from '@/infra/env/env.service';
import { normalizeCorsOrigin } from '@/infra/http/cors/cors.config';

interface SupabaseIdentity {
  id: string;
  email: string;
  fullName: string | null;
}

@Injectable()
export class SupabaseAuthService extends AuthDirectoryRepository {
  constructor(private readonly envService: EnvService) {
    super();
  }

  async signInWithPassword(email: string, password: string) {
    const supabase = createClient(
      this.envService.supabaseUrl,
      this.envService.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user?.email) {
      throw new UnauthorizedException('Invalid login credentials');
    }

    return {
      id: data.user.id,
      email: data.user.email,
      fullName:
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : null,
    } satisfies SupabaseIdentity;
  }

  async getIdentityFromAccessToken(accessToken: string) {
    const supabase = createClient(
      this.envService.supabaseUrl,
      this.envService.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user?.email) {
      throw new UnauthorizedException('Invalid access token');
    }

    return {
      id: data.user.id,
      email: data.user.email,
      fullName:
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : null,
    } satisfies SupabaseIdentity;
  }

  async sendPasswordResetEmail(email: string, redirectTo: string) {
    this.assertAllowedRedirectTo(redirectTo);

    const supabase = createClient(
      this.envService.supabaseUrl,
      this.envService.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      throw new InternalServerErrorException(
        'Unable to process password reset request',
      );
    }
  }

  async confirmPasswordReset(input: {
    accessToken: string;
    refreshToken: string;
    password: string;
  }) {
    const supabase = createClient(
      this.envService.supabaseUrl,
      this.envService.supabasePublishableKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken,
    });

    if (sessionError) {
      throw new UnauthorizedException(
        'Invalid or expired password reset session',
      );
    }

    const { data, error } = await supabase.auth.updateUser({
      password: input.password,
    });

    if (error || !data.user?.email) {
      throw new UnauthorizedException('Unable to update password');
    }

    return {
      id: data.user.id,
      email: data.user.email,
      fullName:
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : null,
    } satisfies SupabaseIdentity;
  }

  async inviteUserByEmail(input: {
    email: string;
    redirectTo: string;
    fullName?: string;
  }): Promise<SupabaseIdentity> {
    this.assertAllowedRedirectTo(input.redirectTo);

    const serviceRoleKey = this.envService.supabaseServiceRoleKey;
    if (!serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase service role key is not configured',
      );
    }

    const supabase = createClient(this.envService.supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: input.redirectTo,
      data: input.fullName ? { full_name: input.fullName } : undefined,
    });

    if (error || !data.user?.email) {
      throw new InternalServerErrorException('Unable to send invitation');
    }

    return {
      id: data.user.id,
      email: data.user.email,
      fullName:
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : input.fullName?.trim() || null,
    } satisfies SupabaseIdentity;
  }

  async listUsers() {
    const serviceRoleKey = this.envService.supabaseServiceRoleKey;
    if (!serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase service role key is not configured',
      );
    }

    const supabase = createClient(this.envService.supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const users: Array<{
      id: string;
      email: string;
      createdAt: Date;
      lastSignInAt: Date | null;
      emailConfirmedAt: Date | null;
    }> = [];

    let page = 1;
    const perPage = 100;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw new InternalServerErrorException('Unable to list users');
      }

      users.push(
        ...data.users
          .filter(
            (
              user,
            ): user is typeof user & {
              email: string;
            } => typeof user.email === 'string' && user.email.length > 0,
          )
          .map((user) => ({
            id: user.id,
            email: user.email,
            createdAt: new Date(user.created_at),
            lastSignInAt: user.last_sign_in_at
              ? new Date(user.last_sign_in_at)
              : null,
            emailConfirmedAt: user.email_confirmed_at
              ? new Date(user.email_confirmed_at)
              : null,
          })),
      );

      if (!data.nextPage || data.users.length === 0) {
        break;
      }

      page = data.nextPage;
    }

    return users;
  }

  async deleteUser(userId: string): Promise<void> {
    const serviceRoleKey = this.envService.supabaseServiceRoleKey;
    if (!serviceRoleKey) {
      throw new ServiceUnavailableException(
        'Supabase admin key is not configured',
      );
    }

    const supabase = createClient(this.envService.supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error } = await supabase.auth.admin.deleteUser(userId, false);

    if (error) {
      throw new InternalServerErrorException('Unable to delete access user');
    }
  }

  private assertAllowedRedirectTo(redirectTo: string) {
    const redirectOrigin = normalizeCorsOrigin(new URL(redirectTo).origin);
    const allowedOrigins = this.envService.corsOrigins;

    if (!allowedOrigins.includes(redirectOrigin)) {
      throw new BadRequestException('Invalid redirect target');
    }
  }
}
