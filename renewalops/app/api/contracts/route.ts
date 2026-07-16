import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const contracts = await prisma.contract.findMany({
      include: {
        client: true,
        emailLogs: true,
      },
      orderBy: {
        renewalDate: "asc",
      },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("GET /api/contracts error:", error);

    return NextResponse.json(
      { error: "Failed to load contracts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const contract = await prisma.contract.create({
      data: {
        clientId: body.clientId,
        contractName: body.contractName,
        type: body.type || "MAINTENANCE",
        status: body.status || "ACTIVE",
        value: Number(body.value || 0),
        assetReference: body.assetReference || null,
        startDate: new Date(body.startDate),
        renewalDate: new Date(body.renewalDate),
      },
      include: {
        client: true,
        emailLogs: true,
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("POST /api/contracts error:", error);

    return NextResponse.json(
      { error: "Failed to create contract" },
      { status: 500 },
    );
  }
}