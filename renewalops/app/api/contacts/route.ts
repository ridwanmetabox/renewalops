import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function toFrontendContact(contact: any) {
  return {
    id: contact.id,
    name: contact.name,
    company: contact.company,
    role: contact.role ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    status: contact.status ?? "Active",
    lastContact: contact.lastContact ?? "",
    notes: contact.notes ?? "",
  };
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const contacts = await prisma.contact.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      contacts: contacts.map(toFrontendContact),
    });
  } catch (error) {
    console.error("Get contacts error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch contacts.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const name = body.name?.trim();
    const company = body.company?.trim() || "";
    const role = body.role?.trim() || null;
    const email = body.email?.trim() || null;
    const phone = body.phone?.trim() || null;
    const status = body.status?.trim() || "Active";
    const lastContact =
      body.lastContact?.trim() || new Date().toISOString().split("T")[0];
    const notes = body.notes?.trim() || null;

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          message: "Contact name is required.",
        },
        { status: 400 }
      );
    }

    const client = company
      ? await prisma.client.findFirst({
          where: {
            companyName: company,
          },
        })
      : null;

    const contact = await prisma.contact.create({
      data: {
        name,
        company,
        role,
        email,
        phone,
        status,
        lastContact,
        notes,
        clientId: client?.id ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contact created successfully.",
      contact: toFrontendContact(contact),
    });
  } catch (error) {
    console.error("Create contact error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to create contact.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}