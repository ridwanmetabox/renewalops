import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "renewalops",
  isDev: process.env.INNGEST_DEV === "1",
});