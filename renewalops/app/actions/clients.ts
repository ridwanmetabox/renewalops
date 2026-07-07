"use server";

import { prisma } from "@/lib/prisma";

export async function createClient(data: {
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
}) {
  return prisma.client.create({
    data,
  });
}

export async function getClients() {
  return prisma.client.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}