import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface InvitationEmail {
  to: string;
  token: string;
  expiresAt: Date;
}

export abstract class LocalInvitationMailSender {
  abstract assertReady(): void;
  abstract sendInvitation(message: InvitationEmail): Promise<void>;
}

interface SenderConfig {
  apiKey: string;
  from: string;
  appOrigin: string;
}

@Injectable()
export class ResendInvitationMailSender extends LocalInvitationMailSender {
  private getConfiguration(): SenderConfig {
    // Intentionally OFF until the frontend accepts locally-issued invitations.
    if (process.env.SWIMFLOW_LOCAL_INVITES_ENABLED !== 'true') {
      throw new ServiceUnavailableException(
        'Local invitations are not enabled',
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    const originValue = process.env.SWIMFLOW_AUTH_APP_ORIGIN;
    if (!apiKey || !from || !originValue) {
      throw new ServiceUnavailableException(
        'Invitation delivery is not configured',
      );
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

  async sendInvitation({
    to,
    token,
    expiresAt,
  }: InvitationEmail): Promise<void> {
    const config = this.getConfiguration();
    // The token stays in the URL fragment and is never logged/server-rendered.
    // Do not turn on the feature flag until this route is implemented.
    const link = new URL('/auth/accept-local-invitation', config.appOrigin);
    link.hash = new URLSearchParams({ token }).toString();

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `***          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: config.from,
          to: [to],
          subject: 'Convite para o Swim Flow',
          text: `Você recebeu um convite para o Swim Flow. Aceite pelo endereço: ${link.toString()}\nO convite expira em ${expiresAt.toISOString()}.\nSe você não esperava este convite, ignore a mensagem.`,
        }),
      });
    } catch {
      // Never reveal fetch exceptions: they can include secret URLs/headers.
      throw new ServiceUnavailableException('Invitation delivery failed');
    }
    if (!response.ok) {
      // Never log/return the provider error body (it may contain personal data).
      throw new ServiceUnavailableException('Invitation delivery failed');
    }
  }
}
