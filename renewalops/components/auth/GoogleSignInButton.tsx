"use client";

import { SignInButton } from "@clerk/nextjs";

export default function GoogleSignInButton() {
  return (
    <SignInButton mode="modal">
      <button
        type="button"
        className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all"
      >
        Continue with Google
      </button>
    </SignInButton>
  );
}