export interface UserPublic {
  id: string
  name: string
  email: string
  role: 'TEACHER' | 'ADMIN'
  isActive: boolean
  createdAt: Date
}

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: 'TEACHER' | 'ADMIN'
}

// Required by @types/express-serve-static-core for Request augmentation
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */
