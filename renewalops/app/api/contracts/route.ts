import { auth } from "@clerk/nextjs/server";
import { ContractStatus, ContractType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function calcDaysLeft(date: Date) {
  const diff = date.getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function toDbContractType(value?: string): ContractType {
  const v = (value ?? "Service").toLowerCase();

  if (v.includes("maintenance")) return ContractType.MAINTENANCE;
  if (v.includes("support")) return ContractType.SUPPORT;

  return ContractType.SERVICE;
}

function toFrontendContractType(value: ContractType) {
  if (value === ContractType.MAINTENANCE) return "Maintenance";
  if (value === ContractType.SUPPORT) return "Support";

  return "Service";
}

function toDbStatus(value?: string): ContractStatus {
  const v = (value ?? "Active").toLowerCase();

  if (v.includes("due")) return ContractStatus.EXPIRING_SOON;
  if (v.includes("overdue")) return ContractStatus.OVERDUE;
  if (v.includes("renewed")) return ContractStatus.RENEWED;
  if (v.includes("cancelled") || v.includes("canceled")) return ContractStatus.DECLINED;
  if (v.includes("declined")) return ContractStatus.DECLINED;

  return ContractStatus.ACTIVE;
}

function toFrontendStatus(status: ContractStatus, renewalDate: Date) {
  const daysLeft = calcDaysLeft(renewalDate);

  if (status === ContractStatus.RENEWED) return "Renewed";
  if (status === ContractStatus.DECLINED) return "Cancelled";
  if (status === ContractStatus.OVERDUE || daysLeft < 0) return "Overdue";
  if (status === ContractStatus.EXPIRING_SOON || daysLeft <= 30) return "Due Soon";

  return "Active";
}

function toFrontendContract(contract: any) {
  const renewalDate = new Date(contract.renewalDate);

  return {
    id: contract.id,
    name: contract.contractName,
    clientId: contract.clientId,
    client: contract.client?.companyName ?? "",
    reference: contract.reference ?? contract.id.slice(0, 8).toUpperCase(),
    serviceDescription: contract.serviceDescription ?? "",
    startDate: formatDate(new Date(contract.startDate)),
    renewalDate: formatDate(renewalDate),
    amount: contract.contractValue ?? 0,
    currency: contract.currency ?? "MUR",
    assignedTo: contract.assignedTo ?? "",
    status: toFrontendStatus(contract.status, renewalDate),
    contractType: toFrontendContractType(contract.contractType),
    daysLeft: calcDaysLeft(renewalDate),
    autoRenew: contract.autoRenewal ?? false,
    renewalFrequency: contract.renewalFrequency ?? "Yearly",
    noticePeriod: contract.noticePeriod ?? "",
    reminders:
      contract.reminders?.map((reminder: any) => ({
        days: reminder.daysBefore,
        sent: reminder.sent,
        scheduledDate: reminder.sentAt
          ? formatDate(new Date(reminder.sentAt))
          : undefined,
      })) ?? [],
    recipientTypes: contract.recipientTypes ?? [],
    notes: contract.notes?.map((note: any) => note.note) ?? [],
  };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const contracts = await prisma.contract.findMany({
    include: {
      client: true,
      reminders: true,
      notes: true,
    },
    orderBy: {
      renewalDate: "asc",
    },
  });

  return NextResponse.json({
    success: true,
    contracts: contracts.map(toFrontendContract),
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const contractName = body.name?.trim() || body.contractName?.trim();
    const clientName = body.client?.trim();
    let clientId = body.clientId?.trim();

    if (!contractName) {
      return NextResponse.json(
        { success: false, message: "Contract name is required." },
        { status: 400 }
      );
    }

    if (!clientId && clientName) {
      const client = await prisma.client.findFirst({
        where: {
          companyName: clientName,
        },
      });

      clientId = client?.id;
    }

    if (!clientId) {
      return NextResponse.json(
        { success: false, message: "Client is required." },
        { status: 400 }
      );
    }

    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const renewalDate = body.renewalDate
      ? new Date(body.renewalDate)
      : new Date();

    const reminders = Array.isArray(body.reminders)
      ? body.reminders
      : [
          { days: 90 },
          { days: 60 },
          { days: 30 },
          { days: 14 },
          { days: 7 },
          { days: 0 },
        ];

    const contract = await prisma.contract.create({
      data: {
        contractName,
        clientId,
        startDate,
        renewalDate,
        contractValue: Number(body.amount ?? body.contractValue ?? 0),
        status: toDbStatus(body.status),
        contractType: toDbContractType(body.contractType),
        autoRenewal: Boolean(body.autoRenew ?? body.autoRenewal ?? false),
        reminders: {
          create: reminders.map((reminder: any) => ({
            daysBefore: Number(reminder.days ?? reminder.daysBefore),
            sent: Boolean(reminder.sent ?? false),
          })),
        },
      },
      include: {
        client: true,
        reminders: true,
        notes: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contract created successfully.",
      contract: toFrontendContract(contract),
    });
  } catch (error) {
    console.error("Create contract error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create contract.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}