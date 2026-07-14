import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export async function getCurrentUser() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("No email address found for this Clerk user.");
  }

  const name =
    clerkUser.fullName ||
    `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
    email;

  const appUser = await prisma.appUser.upsert({
    where: {
      clerkId: clerkUser.id,
    },
    update: {
      email,
      name,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name,
      role: UserRole.STAFF,
    },
  });

  return appUser;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to perform this action.");
  }

  return user;
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();

  if (user.role !== UserRole.ADMIN) {
    throw new Error("You do not have permission to perform this action.");
  }

  return user;
}