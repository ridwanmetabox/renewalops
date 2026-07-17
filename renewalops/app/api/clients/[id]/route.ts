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

    const companyName = body.companyName ?? body.company;
    const mainContactName =
      typeof body.contact === "string" ? body.contact.trim() : "";

    const updatedClient = await prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: {
          id,
        },
        data: {
          companyName: companyName || undefined,
          email: body.email ?? undefined,
          phone: body.phone ?? undefined,
          address: body.billingAddress ?? body.address ?? undefined,
        },
      });

      if (mainContactName) {
        const existingContact = await tx.contact.findFirst({
          where: {
            OR: [
              {
                clientId: id,
              },
              {
                email: body.email || undefined,
              },
            ],
          },
        });

        if (existingContact) {
          await tx.contact.update({
            where: {
              id: existingContact.id,
            },
            data: {
              name: mainContactName,
              company: companyName || client.companyName,
              client: {
                connect: {
                  id,
                },
              },
            },
          });
        } else {
          await tx.contact.create({
            data: {
              name: mainContactName,
              company: companyName || client.companyName,
              email: body.email || null,
              phone: body.phone || null,
              role: "Primary Contact",
              client: {
                connect: {
                  id,
                },
              },
            },
          });
        }
      }

      return tx.client.findUnique({
        where: {
          id,
        },
        include: {
          contacts: true,
          contracts: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error) {
    console.error("PATCH /api/clients/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update client",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      await tx.emailLog.deleteMany({
        where: {
          contract: {
            clientId: id,
          },
        },
      });

      await tx.contract.deleteMany({
        where: {
          clientId: id,
        },
      });

      await tx.contact.deleteMany({
        where: {
          clientId: id,
        },
      });

      await tx.client.delete({
        where: {
          id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/clients/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete client",
      },
      { status: 500 },
    );
  }
}