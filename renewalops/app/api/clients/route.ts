import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      include: {
        contacts: true,
        contracts: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("GET /api/clients error:", error);

    return NextResponse.json(
      { error: "Failed to load clients" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const client = await prisma.client.create({
      data: {
        companyName: body.companyName,
        email: body.email || null,
        phone: body.phone || null,
        address: body.address || null,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients error:", error);

    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 },
    );
  }
}