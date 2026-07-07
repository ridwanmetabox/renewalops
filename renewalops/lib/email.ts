import { resend } from "@/lib/resend";

export async function sendRenewalEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!from) {
    throw new Error("Missing RESEND_FROM_EMAIL");
  }

  return resend.emails.send({
    from,
    to,
    subject,
    html,
  });
}