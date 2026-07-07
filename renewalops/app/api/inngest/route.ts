import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { sendRenewalReminders } from "@/inngest/functions/send-renewal-reminders";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendRenewalReminders],
});