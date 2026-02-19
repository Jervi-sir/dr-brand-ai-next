import type { User as NextAuthUser, Session } from 'next-auth';

export interface ExtendedUser extends NextAuthUser {
    role?: string;
    isVerified?: boolean;
}

export interface ExtendedSession extends Session {
    user: ExtendedUser;
}
