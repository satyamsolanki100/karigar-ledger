import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

// Kept free of database and bcrypt imports so it can run in the proxy (edge) runtime.
export const authConfig = {
  pages: { signIn: "/sign-in" },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role as Role;
      return session;
    },
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/sign-in")) {
        return signedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return signedIn;
    },
  },
} satisfies NextAuthConfig;
