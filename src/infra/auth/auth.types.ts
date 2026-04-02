export type AppRole = 'admin' | 'teacher' | 'user'

export interface AuthUser {
  id: string
  email: string | null
  role: AppRole
}
