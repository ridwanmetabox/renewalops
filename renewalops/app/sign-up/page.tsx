import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LoginBrandPanel from "@/components/auth/LoginBrandPanel";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#F8FBFF] flex">
      <LoginBrandPanel />

      <section className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[500px]">
          <div className="mb-8">
            <p className="text-sm font-bold text-[#30B7AE] mb-2">
              RenewalOps
            </p>

            <h1 className="text-4xl font-black text-[#15233F] mb-3">
              Create your account
            </h1>

            <p className="text-base text-slate-600">
              Sign up to start managing renewals
            </p>
          </div>

          <SignUp
            routing="hash"
            signInUrl="/"
            forceRedirectUrl="/dashboard"
            appearance={clerkAppearance}
          />
        </div>
      </section>
    </main>
  );
}