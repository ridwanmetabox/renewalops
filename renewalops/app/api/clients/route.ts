import { auth } from "@clerk/nextjs/server";
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

function toFrontendClient(client: any) {
  const contracts = client.contracts ?? [];

  const nextContract = contracts
    .filter((contract: any) => contract.renewalDate)
    .sort(
      (a: any, b: any) =>
        new Date(a.renewalDate).getTime() -
        new Date(b.renewalDate).getTime()
    )[0];

  const totalOutstanding = contracts.reduce(
    (sum: number, contract: any) => sum + (contract.contractValue ?? 0),
    0
  );

  const overdueAmount = contracts
    .filter((contract: any) => calcDaysLeft(new Date(contract.renewalDate)) < 0)
    .reduce(
      (sum: number, contract: any) => sum + (contract.contractValue ?? 0),
      0
    );

  return {
    id: client.id,
    company: client.companyName,
    contact: client.contactPerson ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    status: "Active",
    billingAddress: client.address ?? "",
    totalOutstanding,
    overdueAmount,
    nextRenewal: nextContract
      ? formatDate(new Date(nextContract.renewalDate))
      : "—",
    contracts: contracts.length,
    joinDate: formatDate(new Date(client.createdAt)),
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

  const clients = await prisma.client.findMany({
    include: {
      contracts: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    success: true,
    clients: clients.map(toFrontendClient),
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

    const companyName = body.company?.trim() || body.companyName?.trim();
    const contactPerson =
      body.contact?.trim() || body.contactPerson?.trim() || null;
    const email = body.email?.trim() || null;
    const phone = body.phone?.trim() || null;
    const address =
      body.billingAddress?.trim() || body.address?.trim() || null;

    if (!companyName) {
      return NextResponse.json(
        { success: false, message: "Company name is required." },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        companyName,
        contactPerson,
        email,
        phone,
        address,
      },
      include: {
        contracts: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Client created successfully.",
      client: toFrontendClient(client),
    });
  } catch (error) {
    console.error("Create client error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create client.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}