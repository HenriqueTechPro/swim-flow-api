export interface AuthDirectoryUser {
  id: string;
  email: string;
  createdAt: Date;
  lastSignInAt: Date | null;
  emailConfirmedAt: Date | null;
}

export abstract class AuthDirectoryRepository {
  abstract listUsers(): Promise<AuthDirectoryUser[]>;
  abstract deleteUser(userId: string): Promise<void>;
}
