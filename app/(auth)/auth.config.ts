import type { NextAuthConfig } from 'next-auth';
import type { ExtendedUser } from './types';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isVerified = (auth?.user as ExtendedUser)?.isVerified;

      const isOnChat = nextUrl.pathname.startsWith('/');
      const isOnRegister = nextUrl.pathname.startsWith('/register');
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      const isOnUnverified = nextUrl.pathname.startsWith('/unverified');
      if (isLoggedIn && (isOnLogin || isOnRegister)) {
        return Response.redirect(new URL('/', nextUrl as unknown as URL));
      }

      if (isOnRegister || isOnLogin || isOnUnverified) {
        return true;
      }

      if (isLoggedIn) {
        if (!isVerified && !isOnUnverified) {
          return Response.redirect(new URL('/unverified', nextUrl as unknown as URL));
        }
        return true;
      }

      if (isOnChat) {
        return false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.isVerified = (user as ExtendedUser).isVerified;
        token.role = (user as ExtendedUser).role;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.isVerified = token.isVerified;
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
