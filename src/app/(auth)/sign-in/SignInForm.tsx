"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";

const initial: SignInState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="rounded-lg border border-line bg-surface p-6 shadow-sm">
      <label className="block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />

      {state.error ? (
        <p role="alert" className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
