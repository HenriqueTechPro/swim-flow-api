#!/usr/bin/env node
'use strict';

/**
 * Isolated, opt-in Resend transport test for Swim Flow staging.
 *
 * No NestJS bootstrap, database connection, Prisma, action tokens or account
 * creation. This script must never print the key, recipient or API response.
 */
const FROM = 'onboarding@resend.dev';
const APPROVAL = 'SEND_ONE_SWIM_FLOW_STAGING_TEST_EMAIL';
const TO_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function validateSmokeInput(env, args) {
  if (args.length !== 1 || args[0] !== '--send' ||
      env.SWIMFLOW_RESEND_SMOKE_APPROVAL !== APPROVAL) {
    throw new Error('Manual test-email approval is required.');
  }
  if (typeof env.RESEND_API_KEY !== 'string' ||
      !/^re_[A-Za-z0-9_-]{8,}$/.test(env.RESEND_API_KEY)) {
    throw new Error('A valid Resend API key is required.');
  }
  if (env.RESEND_FROM_EMAIL && env.RESEND_FROM_EMAIL !== FROM) {
    throw new Error('The sender must be the official Resend test sender.');
  }
  const recipient = typeof env.SWIMFLOW_RESEND_SMOKE_TO === 'string'
    ? env.SWIMFLOW_RESEND_SMOKE_TO.trim().toLowerCase()
    : '';
  if (recipient.length > 320 || !TO_PATTERN.test(recipient)) {
    throw new Error('A single valid test recipient is required.');
  }
  // Resend restricts onboarding@resend.dev deliveries to the account owner.
  // We cannot verify ownership locally; Resend enforces the restriction.
  return { apiKey: env.RESEND_API_KEY, recipient };
}

async function sendSmokeEmail(config, fetchImpl = fetch) {
  // Only a plain diagnostic note: no real invitations, links or credentials.
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [config.recipient],
      subject: '[Swim Flow staging] Teste de entrega de e-mail',
      text: 'Teste de entrega pelo Resend. Nenhuma conta, convite ou senha foi criado no Swim Flow. Nenhuma acao e necessaria.',
    }),
  });
  if (!response.ok) throw new Error('Resend delivery request not accepted.');
  // Do not log or parse response: provider metadata is not needed here.
  return true;
}

async function main() {
  try {
    const config = validateSmokeInput(process.env, process.argv.slice(2));
    await sendSmokeEmail(config);
    process.stdout.write(
      'Resend aceitou o teste de envio. Confirme o recebimento na caixa de entrada e em Resend > Emails.\n',
    );
  } catch {
    // Provider errors can include request headers or private information.
    process.stderr.write(
      'Teste Resend recusado ou falhou. Confira as variaveis, autorizacao, conta destinataria e painel do Resend.\n',
    );
    process.exitCode = 1;
  }
}

module.exports = { APPROVAL, FROM, validateSmokeInput, sendSmokeEmail };
if (require.main === module) void main();
