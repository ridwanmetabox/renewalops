import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

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

    const contact = await prisma.contact.update({
      where: {
        id,
      },
      data: {
         // Basic contact information
        name: body.name || undefined,
        company: body.company || undefined,
        role: body.role ?? undefined,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,

        // Contact details
        status: body.status ?? undefined,
        lastContact: body.lastContact ?? undefined,
        notes: body.notes ?? undefined,
        
        ...(clientId ? { clientId } : {}),
      },
      include: {
        client: true,
      },
    });

    return NextResponse.json({
      success: true,
      contact,
    });
  } catch (error) {
    console.error("PATCH /api/contacts/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update contact",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.contact.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/contacts/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete contact",
      },
      { status: 500 },
    );
  }
}