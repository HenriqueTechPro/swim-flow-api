import { z } from 'zod';

// Unknown properties must not silently influence identity or permissions.
export const linkTeacherAccountSchema = z.object({
  profileId: z.string().uuid(),
}).strict();

export type LinkTeacherAccountDto = z.infer<typeof linkTeacherAccountSchema>;
