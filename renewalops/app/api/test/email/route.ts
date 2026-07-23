import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;
    const to = process.env.TEST_EMAIL_TO;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing RESEND_API_KEY" },
        { status: 500 },
      );
    }

    if (!from) {
      return NextResponse.json(
        { success: false, error: "Missing EMAIL_FROM or RESEND_FROM_EMAIL" },
        { status: 500 },
      );
    }

    if (!to) {
      return NextResponse.json(
        { success: false, error: "Missing TEST_EMAIL_TO" },
        { status: 500 },
      );
    }

    const resend = new Resend(apiKey);

    const result = await resend.emails.send({
      from,
      to,
      subject: "RenewalOps Test Email",
      html: `
        <h2>RenewalOps email test</h2>
        <p>If you received this email, Resend is working.</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Test email sent",
      result,
    });
  } catch (error) {
    console.error("Test email error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500 },
    );
  }
}