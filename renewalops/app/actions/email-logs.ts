"use server";

import { prisma } from "@/lib/prisma";
import { EmailStatus } from "@prisma/client";

/* ============================================================
   GET EMAIL HISTORY FOR A CONTRACT
   Returns all email logs for one specific contract.
============================================================ */
export async function getEmailLogsByContract(contractId: string) {
  return prisma.emailLog.findMany({
    where: {
      contractId,
    },
    include: {
      contract: {
        include: {
          client: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/* ============================================================
   GET RECENT EMAIL LOGS
   Returns the latest email activity.
============================================================ */
export async function getRecentEmailLogs(limit = 10) {
  return prisma.emailLog.findMany({
    include: {
      contract: {
        include: {
          client: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

/* ============================================================
   GET FAILED EMAILS
   Returns only failed email deliveries.
============================================================ */
export async function getFailedEmails() {
  return prisma.emailLog.findMany({
    where: {
      status: EmailStatus.FAILED,
    },
    include: {
      contract: {
        include: {
          client: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/* ============================================================
   GET EMAIL LOGS BY STATUS
   Returns email logs filtered by status.
============================================================ */
export async function getEmailLogsByStatus(status: EmailStatus) {
  return prisma.emailLog.findMany({
    where: {
      status,
    },
    include: {
      contract: {
        include: {
          client: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}