import { z } from 'zod';

// 32 random bytes encoded as base64url (43 chars, without padding).
const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const acceptLocalInvitationSchema = z
  .object({
    token: invitationTokenSchema,
    password: z
      .string()
      .min(12)
      .max(72)
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
        message: 'Password must be 72 UTF-8 bytes or fewer',
      }),
  })
  .strict();

export type AcceptLocalInvitationDto = z.infer<
  typeof acceptLocalInvitationSchema
>;
