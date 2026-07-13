import { NextResponse } from "next/server";
import { sendRenewalEmail } from "@/lib/email";

export async function GET() {
  try {
    const result = await sendRenewalEmail({
      to: "ridwan.metabox@outlook.com",
      subject: "RenewalOps Test Email",
      html: `
        <h2>RenewalOps Test Email</h2>
        <p>If you received this, Resend is working.</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      result,
    });
  } catch (error) {
    console.error("Resend test error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to send email",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}