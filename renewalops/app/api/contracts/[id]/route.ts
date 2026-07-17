import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const contractInclude = {
  client: true,
  emailLogs: true,
  reminders: true,
  notes: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
};

function toContractType(value: unknown) {
  const normalized = String(value ?? "SERVICE")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  if (normalized === "MAINTENANCE") return "MAINTENANCE";
  if (normalized === "SUPPORT") return "SUPPORT";
  if (normalized === "LICENSING") return "LICENSING";

  return "SERVICE";
}

function toContractStatus(value: unknown) {
  const normalized = String(value ?? "ACTIVE")
    .trim()
    .toUpperCase()
    .replaceAll(" ", "_")
    .replaceAll("-", "_");

  if (normalized === "ACTIVE") return "ACTIVE";
  if (normalized === "DUE_SOON") return "EXPIRING_SOON";
  if (normalized === "EXPIRING_SOON") return "EXPIRING_SOON";
  if (normalized === "OVERDUE") return "OVERDUE";
  if (normalized === "RENEWED") return "RENEWED";
  if (normalized === "DECLINED") return "DECLINED";
  if (normalized === "CANCELLED") return "CANCELLED";
  if (normalized === "ON_HOLD") return "ON_HOLD";

  return "ACTIVE";
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function reminderDaysFromBody(body: Record<string, unknown>) {
  const reminders = Array.isArray(body.reminders) ? body.reminders : [];

  return reminders
    .map((reminder) => {
      if (!reminder || typeof reminder !== "object") return null;

      const record = reminder as Record<string, unknown>;
      const parsed = Number(record.days ?? record.daysBefore);

      if (!Number.isFinite(parsed)) return null;

      return {
        daysBefore: parsed,
        sent: Boolean(record.sent),
      };
    })
    .filter((item): item is { daysBefore: number; sent: boolean } => item !== null);
}

function notesFromBody(body: Record<string, unknown>) {
  const notes = Array.isArray(body.notes) ? body.notes : [];

  return notes
    .map((note) => {
      if (typeof note === "string") return note.trim();

      if (note && typeof note === "object") {
        const record = note as Record<string, unknown>;
        return String(record.note ?? "").trim();
      }

      return "";
    })
    .filter(Boolean);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;

    const contractName = String(body.contractName ?? body.name ?? "").trim();

    if (!contractName) {
      return NextResponse.json(
        {
          success: false,
          error: "Contract name is required",
        },
        { status: 400 },
      );
    }

    const updatedContract = await prisma.contract.update({
      where: {
        id,
      },
      data: {
        contractName,
        contractType: toContractType(body.contractType ?? body.type),
        status: toContractStatus(body.status),
        reference: String(body.reference ?? "").trim() || null,
        serviceDescription: String(body.serviceDescription ?? "").trim() || null,
        startDate: new Date(String(body.startDate ?? new Date())),
        renewalDate: new Date(String(body.renewalDate ?? new Date())),
        contractValue: numberOrNull(
          body.contractValue ?? body.amount ?? body.value,
        ),
        currency: String(body.currency ?? "MUR").trim() || "MUR",
        autoRenewal: Boolean(body.autoRenewal ?? body.autoRenew),
        renewalFrequency:
          String(body.renewalFrequency ?? "Yearly").trim() || "Yearly",
        noticePeriod: String(body.noticePeriod ?? "").trim() || null,
        assignedTo: String(body.assignedTo ?? "").trim() || null,
        recipientTypes: Array.isArray(body.recipientTypes)
          ? body.recipientTypes.map(String)
          : [],
      },
    });

    const reminders = reminderDaysFromBody(body);

    if (reminders.length > 0) {
      await prisma.renewalReminder.deleteMany({
        where: {
          contractId: id,
        },
      });

      await prisma.renewalReminder.createMany({
        data: reminders.map((reminder) => ({
          contractId: id,
          daysBefore: reminder.daysBefore,
          sent: reminder.sent,
        })),
      });
    }

    const incomingNotes = notesFromBody(body);

    if (incomingNotes.length > 0) {
      const existingNotes = await prisma.internalNote.findMany({
        where: {
          contractId: id,
        },
        select: {
          note: true,
        },
      });

      const existingNoteSet = new Set(
        existingNotes.map((existingNote) => existingNote.note),
      );

      const newNotes = incomingNotes.filter(
        (note) => !existingNoteSet.has(note),
      );

      if (newNotes.length > 0) {
        await prisma.internalNote.createMany({
          data: newNotes.map((note) => ({
            contractId: id,
            note,
          })),
        });
      }
    }

    const contract = await prisma.contract.findUnique({
      where: {
        id: updatedContract.id,
      },
      include: contractInclude,
    });

    return NextResponse.json({
      success: true,
      contract,
    });
  } catch (error) {
    console.error("PATCH /api/contracts/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update contract",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.contract.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    console.error("DELETE /api/contracts/[id] error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete contract",
      },
      { status: 500 },
    );
  }
}