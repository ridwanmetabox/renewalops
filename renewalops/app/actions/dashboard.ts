"use server";

import { prisma } from "@/lib/prisma";
import { ContractStatus } from "@prisma/client";

/* ============================================================
   DASHBOARD STATISTICS
   Returns all statistics needed by the dashboard page.
============================================================ */
export async function getDashboardStats() {
  // Total number of contracts
  const totalContracts = await prisma.contract.count();

  // Active contracts
  const activeContracts = await prisma.contract.count({
    where: {
      status: ContractStatus.ACTIVE,
    },
  });

  // Contracts that are expiring soon
  const expiringSoon = await prisma.contract.count({
    where: {
      status: ContractStatus.EXPIRING_SOON,
    },
  });

  // Overdue contracts
  const overdueContracts = await prisma.contract.count({
    where: {
      status: ContractStatus.OVERDUE,
    },
  });

  // Renewed contracts
  const renewedContracts = await prisma.contract.count({
    where: {
      status: ContractStatus.RENEWED,
    },
  });

  // Declined contracts
  const declinedContracts = await prisma.contract.count({
    where: {
      status: ContractStatus.DECLINED,
    },
  });

  return {
    totalContracts,
    activeContracts,
    expiringSoon,
    overdueContracts,
    renewedContracts,
    declinedContracts,
  };
}

/* ============================================================
   CONTRACTS BY TYPE
   Returns the number of contracts grouped by type.
============================================================ */
export async function getContractsByType() {
  return prisma.contract.groupBy({
    by: ["contractType"],
    _count: {
      contractType: true,
    },
  });
}

/* ============================================================
   UPCOMING RENEWALS
   Returns the next contracts due for renewal.
============================================================ */
export async function getUpcomingRenewals(limit = 10) {
  const today = new Date();

  return prisma.contract.findMany({
    where: {
      renewalDate: {
        gte: today,
      },
    },
    include: {
      client: true,
      assignedStaff: true,
    },
    orderBy: {
      renewalDate: "asc",
    },
    take: limit,
  });
}

/* ============================================================
   RECENT EMAIL LOGS
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