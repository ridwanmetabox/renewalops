import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(contacts);
  } catch (error) {
    console.error("GET /api/contacts error:", error);

    return NextResponse.json(
      { error: "Failed to load contacts" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const contact = await prisma.contact.create({
      data: {
        clientId: body.clientId,
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        role: body.role || null,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    console.error("POST /api/contacts error:", error);

    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 },
    );
  }
}