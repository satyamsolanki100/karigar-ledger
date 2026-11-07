import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · Karigar Ledger" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-gold text-sm font-semibold text-white">
            KL
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Karigar Ledger</h1>
          <p className="mt-1 text-sm text-ink-soft">Workshop gold issue and receipt book</p>
        </div>
        <SignInForm />
        <p className="mt-8 text-xs leading-5 text-ink-faint">
          Demo accounts: clerk@karigar.demo for the issue clerk and finance@karigar.demo for the
          finance head. Password is in deployment.md.
        </p>
      </div>
    </main>
  );
}
