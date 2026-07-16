"use server";

import { prisma } from "@/lib/prisma";

/* ============================================================
   CREATE CLIENT
   Creates a new client/company.
============================================================ */
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

/* ============================================================
   GET ALL CLIENTS
   Returns every client ordered by newest first.
============================================================ */
export async function getClients() {
  return prisma.client.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

/* ============================================================
   GET CLIENT BY ID
   Returns one client together with all of its contracts.
============================================================ */
export async function getClientById(id: string) {
  return prisma.client.findUnique({
    where: {
      id,
    },
    include: {
      contracts: {
        include: {
          assignedStaff: true,
          reminders: true,
        },
        orderBy: {
          renewalDate: "asc",
        },
      },
    },
  });
}

/* ============================================================
   UPDATE CLIENT
   Updates the client's information.
============================================================ */
export async function updateClient(
  id: string,
  data: {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
  }
) {
  return prisma.client.update({
    where: {
      id,
    },
    data,
  });
}

/* ============================================================
   DELETE CLIENT
   Deletes the client.
   Related contracts will also be deleted because of
   the Cascade relation in Prisma.
============================================================ */
export async function deleteClient(id: string) {
  return prisma.client.delete({
    where: {
      id,
    },
  });
}

/* ============================================================
   GET CLIENT CONTRACTS
   Returns only the contracts for one client.
============================================================ */
export async function getClientContracts(id: string) {
  return prisma.contract.findMany({
    where: {
      clientId: id,
    },
    include: {
      assignedStaff: true,
      reminders: true,
      emailLogs: true,
    },
    orderBy: {
      renewalDate: "asc",
    },
  });
}