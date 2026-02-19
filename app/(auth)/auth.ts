import { compare } from 'bcrypt-ts';
import NextAuth, { type User as NextAuthUser, type Session } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { getUser, createUser } from '@/lib/db/queries';
import { authConfig } from './auth.config';
import type { ExtendedUser, ExtendedSession } from './types';

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          redirect_uri: process.env.AUTH_TRUST_HOST + '/api/auth/callback/google'
        },

      }
    }),
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        try {
          const users = await getUser(email);
          if (users.length === 0) return null;
          const user = users[0];
          const passwordsMatch = await compare(password, user.password || '');
          if (!passwordsMatch) return null;
          return {
            id: user.id.toString(),
            email: user.email,
            role: user.role || 'user',
            isVerified: user.isVerified ?? false,
          } as ExtendedUser;
        } catch (error) {
          console.error('Credentials authorize error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === 'google' && user.email) {
          const existingUsers = await getUser(user.email);
          if (existingUsers.length === 0) {
            await createUser(user.email, null);
          }
          return true;
        }
        return true;
      } catch (error) {
        console.error('signIn callback error:', error);
        return `/login?error=CallbackError`;
      }
    },
    async jwt({ token, user, trigger, session }) {
      try {
        if (user) {
          token.id = user.id;
          token.role = (user as ExtendedUser).role || 'user';
          token.isVerified = (user as ExtendedUser).isVerified ?? false;
        }

        if (trigger === 'update') {
          const dbUsers = await getUser(token.email as string);
          if (dbUsers.length > 0) {
            token.isVerified = dbUsers[0].isVerified;
            token.role = dbUsers[0].role || token.role;
          }
        }

        return token;
      } catch (error) {
        console.error('JWT callback error:', error);
        return token;
      }
    },
    async session({ session, token }: { session: ExtendedSession; token: any }) {
      try {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.isVerified = token.isVerified as boolean;
          const dbUsers = await getUser(session.user.email || '');
          if (dbUsers.length > 0) {
            const dbUser = dbUsers[0];
            session.user.id = dbUser.id as string;
            session.user.role = dbUser.role || token.role || 'user';
            session.user.isVerified = dbUser.isVerified ?? (token.isVerified as boolean) ?? false;
          }
        }
        return session;
      } catch (error) {
        console.error('Session callback error:', error);
        return session;
      }
    },
  },
  pages: {
    error: '/login',
  },
});