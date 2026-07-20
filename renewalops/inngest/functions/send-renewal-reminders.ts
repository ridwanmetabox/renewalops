import { Resend } from "resend";
import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_TIMEZONE = "Indian/Mauritius";

function getDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function dateKeyToUtcMs(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetweenDateKeys(fromDateKey: string, toDateKey: string): number {
  const fromMs = dateKeyToUtcMs(fromDateKey);
  const toMs = dateKeyToUtcMs(toDateKey);

  return Math.round((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

function reminderLabel(daysBefore: number): string {
  if (daysBefore === 0) return "On renewal date";
  if (daysBefore === 1) return "1 day before renewal";
  return `${daysBefore} days before renewal`;
}

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();

  if (!email.includes("@")) return null;

  return email;
}

function uniqueEmails(emails: Array<string | null | undefined>): string[] {
  return Array.from(new Set(emails.filter(Boolean) as string[]));
}

export const sendRenewalReminders = inngest.createFunction(
  {
    id: "send-renewal-reminders",
    name: "Send Renewal Reminders",
    triggers: [{ cron: "0 9 * * *" }],
  },
  async ({ step }) => {
    return await step.run("check-and-send-renewal-reminders", async () => {
      console.log("Renewal reminder function started");

      if (!process.env.RESEND_API_KEY) {
        console.error("Missing RESEND_API_KEY");
        return {
          success: false,
          reason: "Missing RESEND_API_KEY",
          checkedContracts: 0,
          emailsSent: 0,
        };
      }

      const emailFrom =
        process.env.EMAIL_FROM ||
        process.env.RESEND_FROM_EMAIL ||
        "RenewalOps <onboarding@resend.dev>";

      const todayKey = getDateKey(new Date());

      console.log("Today key:", todayKey);

      const contracts = await prisma.contract.findMany({
        where: {
          status: {
            in: ["ACTIVE", "EXPIRING_SOON", "OVERDUE"],
          },
        },
        include: {
          client: {
            include: {
              contacts: true,
            },
          },
          reminders: {
            orderBy: {
              daysBefore: "desc",
            },
          },
          emailLogs: true,
        },
        orderBy: {
          renewalDate: "asc",
        },
      });

      console.log("Contracts found:", contracts.length);

      let emailsSent = 0;
      let emailsFailed = 0;
      let remindersMatched = 0;
      let contractsChecked = 0;

      for (const contract of contracts) {
        contractsChecked += 1;

        const renewalKey = getDateKey(contract.renewalDate);
        const daysUntilRenewal = daysBetweenDateKeys(todayKey, renewalKey);

        console.log("Checking contract:", {
          id: contract.id,
          contractName: contract.contractName,
          status: contract.status,
          renewalDate: contract.renewalDate,
          renewalKey,
          daysUntilRenewal,
          reminders: contract.reminders.map((reminder) => ({
            id: reminder.id,
            daysBefore: reminder.daysBefore,
            sent: reminder.sent,
          })),
          clientEmail: contract.client.email,
          contactEmails: contract.client.contacts.map((contact) => contact.email),
        });

        const dueReminders = contract.reminders.filter((reminder) => {
          return reminder.daysBefore === daysUntilRenewal && reminder.sent === false;
        });

        if (dueReminders.length === 0) {
          console.log("No due reminders for contract:", contract.contractName);
          continue;
        }

        for (const reminder of dueReminders) {
          remindersMatched += 1;

          const stage = String(reminder.daysBefore);

          const alreadySent = await prisma.emailLog.findFirst({
            where: {
              contractId: contract.id,
              reminderStage: stage,
              status: "SENT",
            },
          });

          if (alreadySent) {
            console.log("Reminder already sent, skipping:", {
              contractId: contract.id,
              reminderStage: stage,
            });

            await prisma.renewalReminder.update({
              where: {
                id: reminder.id,
              },
              data: {
                sent: true,
                sentAt: alreadySent.sentAt ?? new Date(),
              },
            });

            continue;
          }

          const recipients = uniqueEmails([
            cleanEmail(contract.client.email),
            ...contract.client.contacts.map((contact) => cleanEmail(contact.email)),
          ]);

          const subject = `Renewal Reminder: ${contract.contractName}`;

          if (recipients.length === 0) {
            console.error("No recipients found for contract:", contract.contractName);

            await prisma.emailLog.create({
              data: {
                contractId: contract.id,
                recipient: "missing-recipient",
                subject,
                reminderStage: stage,
                status: "FAILED",
                errorMessage: "No valid recipient email found for this contract/client.",
              },
            });

            emailsFailed += 1;
            continue;
          }

          const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>RenewalOps Contract Reminder</h2>

              <p>Hello,</p>

              <p>This is a renewal reminder for the following contract:</p>

              <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;"><strong>Client</strong></td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${contract.client.companyName}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;"><strong>Contract</strong></td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${contract.contractName}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;"><strong>Reference</strong></td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${contract.reference || "N/A"}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;"><strong>Renewal Date</strong></td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${renewalKey}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 8px;"><strong>Reminder Stage</strong></td>
                  <td style="border: 1px solid #ddd; padding: 8px;">${reminderLabel(reminder.daysBefore)}</td>
                </tr>
              </table>

              <p>Please review this contract and take the required renewal action.</p>

              <p>Regards,<br/>RenewalOps</p>
            </div>
          `;

          try {
            console.log("Sending reminder email:", {
              contractId: contract.id,
              contractName: contract.contractName,
              recipients,
              reminderStage: stage,
            });

            const result = await resend.emails.send({
              from: emailFrom,
              to: recipients,
              subject,
              html,
            });

            await prisma.emailLog.create({
              data: {
                contractId: contract.id,
                recipient: recipients.join(", "),
                subject,
                reminderStage: stage,
                status: "SENT",
                sentAt: new Date(),
              },
            });

            await prisma.renewalReminder.update({
              where: {
                id: reminder.id,
              },
              data: {
                sent: true,
                sentAt: new Date(),
              },
            });

            console.log("Reminder email sent:", {
              contractId: contract.id,
              contractName: contract.contractName,
              result,
            });

            emailsSent += 1;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Unknown email sending error";

            console.error("Reminder email failed:", {
              contractId: contract.id,
              contractName: contract.contractName,
              error: errorMessage,
            });

            await prisma.emailLog.create({
              data: {
                contractId: contract.id,
                recipient: recipients.join(", "),
                subject,
                reminderStage: stage,
                status: "FAILED",
                errorMessage,
              },
            });

            emailsFailed += 1;
          }
        }
      }

      const summary = {
        success: true,
        checkedContracts: contractsChecked,
        remindersMatched,
        emailsSent,
        emailsFailed,
      };

      console.log("Renewal reminder function completed:", summary);

      return summary;
    });
  },
);