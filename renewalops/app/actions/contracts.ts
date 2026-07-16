"use server";

import { prisma } from "@/lib/prisma";
import { ContractStatus, ContractType } from "@prisma/client";

/* ============================================================
   CREATE CONTRACT
   Creates a brand new maintenance contract.
============================================================ */

export async function createContract(data: {
  contractName: string;
  contractType: ContractType;
  startDate: Date;
  renewalDate: Date;
  contractValue?: number;
  clientId: string;
  assignedStaffId?: string;
}) {
  return prisma.contract.create({
    data,
  });
}

/* ============================================================
   GET ALL CONTRACTS
   Returns every contract ordered by renewal date.
============================================================ */

export async function getContracts() {
  return prisma.contract.findMany({
    include: {
      client: true,
      assignedStaff: true,
    },
    orderBy: {
      renewalDate: "asc",
    },
  });
}

/* ============================================================
   GET ONE CONTRACT
============================================================ */

export async function getContractById(id: string) {
  return prisma.contract.findUnique({
    where: {
      id,
    },
    include: {
      client: true,
      assignedStaff: true,
      reminders: true,
      emailLogs: {
        orderBy: {
          createdAt: "desc",
        },
      },
      notes: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

/* ============================================================
   UPDATE CONTRACT
   Updates an existing contract.
============================================================ */

export async function updateContract(
  id: string,
  data: {
    contractName?: string;
    contractType?: ContractType;
    startDate?: Date;
    renewalDate?: Date;
    contractValue?: number;
    assignedStaffId?: string;
  }
) {
  return prisma.contract.update({
    where: {
      id,
    },
    data,
  });
}

/* ============================================================
   DELETE CONTRACT
   Permanently removes a contract.
============================================================ */

export async function deleteContract(id: string) {
  return prisma.contract.delete({
    where: {
      id,
    },
  });
}

/* ============================================================
   MARK CONTRACT AS RENEWED
============================================================ */

export async function markContractAsRenewed(id: string) {
  return prisma.contract.update({
    where: {
      id,
    },
    data: {
      status: ContractStatus.RENEWED,
    },
  });
}

/* ============================================================
   MARK CONTRACT AS DECLINED
============================================================ */

export async function markContractAsDeclined(id: string) {
  return prisma.contract.update({
    where: {
      id,
    },
    data: {
      status: ContractStatus.DECLINED,
    },
  });
}

/* ============================================================
   UPCOMING RENEWALS
   Returns contracts that are still active or expiring soon.
============================================================ */

export async function getUpcomingRenewals() {
  return prisma.contract.findMany({
    where: {
      status: {
        in: [
          ContractStatus.ACTIVE,
          ContractStatus.EXPIRING_SOON,
        ],
      },
    },
    include: {
      client: true,
      assignedStaff: true,
    },
    orderBy: {
      renewalDate: "asc",
    },
  });
}