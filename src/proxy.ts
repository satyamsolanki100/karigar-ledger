import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Optimistic redirect only; every page and action re-checks the session server-side.
export const proxy = NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
