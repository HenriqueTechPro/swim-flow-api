import { z } from 'zod';

/** Strict DTO: do not accept caller-controlled redirect URLs. */
export const localAdminInvitationSchema = z
  .object({
    email: z.string().trim().email().max(320),
    fullName: z.string().trim().min(1).max(120).optional(),
    role: z.enum(['admin', 'teacher', 'user']).default('user'),
  })
  .strict();

export type LocalAdminInvitationDto = z.infer<
  typeof localAdminInvitationSchema
>;
