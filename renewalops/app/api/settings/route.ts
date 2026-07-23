import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function isValidSettingKey(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
    const rows = await prisma.appSetting.findMany({
      where: {
        clerkId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const settings = rows.reduce<Record<string, unknown>>((result, row) => {
      result[row.key] = row.value;
      return result;
    }, {});

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Get settings error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load settings.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
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

    const key = body.key;
    const value = body.value ?? {};

    if (!isValidSettingKey(key)) {
      return NextResponse.json(
        {
          success: false,
          message: "Settings key is required.",
        },
        { status: 400 }
      );
    }

    const setting = await prisma.appSetting.upsert({
      where: {
        clerkId_key: {
          clerkId: userId,
          key,
        },
      },
      update: {
        value: value as Prisma.InputJsonValue,
      },
      create: {
        clerkId: userId,
        key,
        value: value as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Settings saved successfully.",
      setting,
    });
  } catch (error) {
    console.error("Save settings error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save settings.",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}