import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LoginBrandPanel from "@/components/auth/LoginBrandPanel";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background flex">
      <LoginBrandPanel />

      <section className="flex-1 flex items-center justify-center bg-black text-white px-8 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10">
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-sm text-zinc-300">
              Sign in to your account to continue
            </p>
          </div>

          <SignIn
            routing="hash"
            forceRedirectUrl="/dashboard"
            signUpForceRedirectUrl="/dashboard"
          />
        </div>
      </section>
    </main>
  );
}