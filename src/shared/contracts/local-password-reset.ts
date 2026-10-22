import { z } from 'zod';

const actionToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const requestLocalPasswordResetSchema = z
  .object({ email: z.string().trim().email().max(320) })
  .strict();

export const confirmLocalPasswordResetSchema = z
  .object({
    token: actionToken,
    password: z
      .string()
      .min(12)
      .max(72)
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
        message: 'Password must be 72 UTF-8 bytes or fewer',
      }),
  })
  .strict();

export type RequestLocalPasswordResetDto = z.infer<
  typeof requestLocalPasswordResetSchema
>;
export type ConfirmLocalPasswordResetDto = z.infer<
  typeof confirmLocalPasswordResetSchema
>;
