import { z } from 'zod';

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(6).max(72);
const redirectToSchema = z.string().trim().url();

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
  redirectTo: redirectToSchema,
});

export const confirmPasswordResetSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  password: passwordSchema,
});

export const oauthLoginSchema = z.object({
  accessToken: z.string().min(1),
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1).max(120).optional(),
  redirectTo: redirectToSchema,
});

export type LoginDto = z.infer<typeof loginSchema>;
export type RequestPasswordResetDto = z.infer<
  typeof requestPasswordResetSchema
>;
export type ConfirmPasswordResetDto = z.infer<
  typeof confirmPasswordResetSchema
>;
export type OAuthLoginDto = z.infer<typeof oauthLoginSchema>;
export type InviteUserDto = z.infer<typeof inviteUserSchema>;
