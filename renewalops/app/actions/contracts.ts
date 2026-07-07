"use server";

import { prisma } from "@/lib/prisma";
import { ContractType } from "@prisma/client";

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