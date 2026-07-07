import { inngest } from "@/lib/inngest";
import { prisma } from "@/lib/prisma";
import { sendRenewalEmail } from "@/lib/email";

const REMINDER_DAYS = [90, 60, 30, 14, 7, 0];

export const sendRenewalReminders = inngest.createFunction(
  {
    id: "send-renewal-reminders",
    name: "Send Renewal Reminders",
    triggers: [{ cron: "0 9 * * *" }],
  },
  async ({ step }) => {
    const contracts = await step.run("Find upcoming contracts", async () => {
      const today = new Date();

      return prisma.contract.findMany({
        include: {
          client: true,
          emailLogs: true,
        },
        where: {
          status: {
            in: ["ACTIVE", "EXPIRING_SOON"],
          },
          renewalDate: {
            gte: today,
          },
        },
      });
    });

    for (const contract of contracts) {
      await step.run(`Check contract ${contract.id}`, async () => {
        const today = new Date();
        const renewalDate = new Date(contract.renewalDate);

        const diffTime = renewalDate.getTime() - today.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (!REMINDER_DAYS.includes(daysLeft)) {
          return;
        }

        const recipient = contract.client.email;

        if (!recipient) {
          return;
        }

        const reminderStage = `${daysLeft} days before`;

        const alreadySent = contract.emailLogs.some(
          (log) => log.reminderStage === reminderStage,
        );

        if (alreadySent) {
          return;
        }

        const subject = `Renewal Reminder: ${contract.contractName}`;

        const html = `
          <h2>Renewal Reminder</h2>
          <p>The contract <strong>${contract.contractName}</strong> for ${contract.client.companyName} is due for renewal.</p>
          <p><strong>Renewal date:</strong> ${renewalDate.toDateString()}</p>
          <p><strong>Days left:</strong> ${daysLeft}</p>
        `;

        try {
          await sendRenewalEmail({
            to: recipient,
            subject,
            html,
          });

          await prisma.emailLog.create({
            data: {
              contractId: contract.id,
              recipient,
              subject,
              reminderStage,
              status: "SENT",
              sentAt: new Date(),
            },
          });
        } catch (error) {
          await prisma.emailLog.create({
            data: {
              contractId: contract.id,
              recipient,
              subject,
              reminderStage,
              status: "FAILED",
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      });
    }

    return {
      checked: contracts.length,
    };
  },
);