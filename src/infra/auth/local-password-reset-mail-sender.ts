import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface PasswordResetEmail {
  to: string;
  token: string;
  expiresAt: Date;
}

export abstract class LocalPasswordResetMailSender {
  abstract assertReady(): void;
  abstract sendReset(message: PasswordResetEmail): Promise<void>;
}

interface ResetSenderConfig {
  apiKey: string;
  from: string;
  appOrigin: string;
}

/**
 * Feature-gated until the frontend reset screen and API redemption route are
 * implemented. Tokens travel only to a verified mail address and appear in
 * a URL fragment, never in a server access-log query string.
 */
@Injectable()
export class ResendPasswordResetMailSender extends LocalPasswordResetMailSender {
  private getConfiguration(): ResetSenderConfig {
    if (process.env.SWIMFLOW_LOCAL_PASSWORD_RESET_ENABLED !== 'true') {
      throw new ServiceUnavailableException('Local password reset is not enabled');
    }
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const originValue = process.env.SWIMFLOW_AUTH_APP_ORIGIN;
    if (!apiKey || !from || !originValue) {
      throw new ServiceUnavailableException('Password reset delivery is not configured');
    }
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)) {
      throw new ServiceUnavailableException('Invalid sender configuration');
    }
    let origin: URL;
    try {
      origin = new URL(originValue);
    } catch {
      throw new ServiceUnavailableException('Invalid application origin');
    }
    if (
      origin.protocol !== 'https:' ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash
    ) {
      throw new ServiceUnavailableException('Application origin must be HTTPS');
    }
    return { apiKey, from, appOrigin: origin.origin };
  }

  assertReady(): void {
    this.getConfiguration();
  }

  async sendReset({ to, token, expiresAt }: PasswordResetEmail): Promise<void> {
    const config = this.getConfiguration();
    const link = new URL('/auth/reset-local-password', config.appOrigin);
    link.hash = new URLSearchParams({ token }).toString();
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: ['Bearer', config.apiKey].join(' '),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          subject: 'Redefinição de senha — Swim Flow',
          text: `Recebemos uma solicitação para redefinir sua senha no Swim Flow. Abra: ${link.toString()}\nEste link expira em ${expiresAt.toISOString()}.\nSe você não solicitou esta mudança, ignore esta mensagem.`,
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Password reset delivery failed');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Password reset delivery failed');
    }
  }
}
