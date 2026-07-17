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

    return NextResponse.json({
      success: true,
      contacts,
    });
  } catch (error) {
    console.error("GET /api/contacts error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load contacts",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.company || !body.email) {
      return NextResponse.json(
        {
          success: false,
          error: "Name, company and email are required",
        },
        { status: 400 },
      );
    }

    let clientId = body.clientId || "";

    if (!clientId && body.company) {
      const matchingClient = await prisma.client.findFirst({
        where: {
          companyName: body.company,
        },
        select: {
          id: true,
        },
      });

      clientId = matchingClient?.id || "";
    }

    const contact = await prisma.contact.create({
      data: {
        name: body.name,
        company: body.company,
        role: body.role || null,
        email: body.email || null,
        phone: body.phone || null,
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        contact,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/contacts error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create contact",
      },
      { status: 500 },
    );
  }
}