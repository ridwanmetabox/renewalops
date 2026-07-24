"use client";
import { useTheme } from "next-themes";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  LayoutDashboard, Users, BookUser, Settings, Bell, Search,
  ChevronRight, ArrowRight, Plus, Edit2, Trash2, Phone, Mail, Eye, EyeOff,
  X, Check, AlertTriangle, FileText, HelpCircle, Building, Lock, Sliders,
  ChevronDown, ChevronUp, Archive, LogOut, User, RefreshCw, Download,
  CheckCircle, XCircle, Calendar, MessageSquare, Clock, CalendarDays,
  ArrowLeft, Sun, Moon, RotateCcw, Ban, Menu
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PageKey =
  | "dashboard"
  | "clients"
  | "contracts"
  | "renewals"
  | "settings";
  

function getPageFromPath(pathname: string): PageKey {
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/contracts")) return "contracts";
  if (pathname.startsWith("/renewals")) return "renewals";
  //if (pathname.startsWith("/notifications")) return "notifications";
 //if (pathname.startsWith("/reports")) return "reports";
  if (pathname.startsWith("/settings")) return "settings";
  //if (pathname.startsWith("/team")) return "team";
  return "dashboard";
}

type Page =
  | "login" | "signup"
  | "dashboard"
  | "clients" | "client-detail"
  | "contacts" | "contact-detail"
  | "contracts" | "contract-detail"
  | "settings" | "settings-account" | "settings-org" | "settings-security"
  | "settings-email" | "settings-help" | "settings-terms"
  | "admin" | "notifications";

type Status = "Active" | "Pending" | "Overdue" | "Due Soon" | "Cancelled" | "On Track" | "Renewed" | "On Hold";

interface Client {
  id: string; company: string; contact: string; email: string; phone: string;
  status: Status; billingAddress: string; totalOutstanding: number;
  overdueAmount: number; nextRenewal: string; contracts: number; joinDate: string;
}

interface Contact {
  id: string; name: string; company: string; role: string; email: string;
  phone: string; status: Status; lastContact: string; notes: string;
}

interface ContractReminder { days: number; sent: boolean; scheduledDate?: string; }

interface Contract {
  id: string; name: string; clientId: string; client: string;
  reference: string; serviceDescription: string; startDate: string;
  renewalDate: string; amount: number; currency: string;
  assignedTo: string; status: Status; contractType: string; daysLeft: number;
  autoRenew: boolean; renewalFrequency: "Monthly" | "Quarterly" | "Yearly" | "Custom";
  noticePeriod: string; reminders: ContractReminder[];
  recipientTypes: string[]; notes: string[];
}

interface Notification {
  id: string; title: string; message: string; time: string;
  read: boolean; archived: boolean; type: "renewal" | "alert" | "info" | "overdue";
  detail?: string;
}

type NotificationOverride = {
  read?: boolean;
  archived?: boolean;
  deleted?: boolean;
};

interface Toast { id: string; message: string; type: "success" | "error" | "info"; }
type UserProfile = {
  name: string;
  email: string;
  phone: string;
  role: string;
};


type OrganizationProfile = {
  name: string;
  industry: string;
  brn: string;
  vat: string;
  website: string;
  country: string;
  address: string;
};

type AppPreferences = {
  emailAlerts: boolean;
  failedAlerts: boolean;
  renewalAlerts: boolean;
  weeklyDigest: boolean;
  smsAlerts: boolean;
};

type EmailTemplateSetting = {
  name: string;
  active: boolean;
};

const USER_PROFILE_STORAGE_KEY = "renewalops:user-profile";
const ORGANIZATION_PROFILE_STORAGE_KEY = "renewalops:organization-profile";
const APP_PREFERENCES_STORAGE_KEY = "renewalops:preferences";
const EMAIL_TEMPLATES_STORAGE_KEY = "renewalops:email-templates";

const DEFAULT_USER_PROFILE: UserProfile = {
  name: "RenewalOps User",
  email: "",
  phone: "+230 5XXX XXXX",
  role: "Administrator",
};

const DEFAULT_ORGANIZATION_PROFILE: OrganizationProfile = {
  name: "RenewalOps (Mauritius) Ltd",
  industry: "Technology Services",
  brn: "C24012345678",
  vat: "MU12345678",
  website: "www.renewalops.mu",
  country: "Mauritius",
  address: "Level 5, Ebène Cybercity, 72201, Mauritius",
};

const DEFAULT_APP_PREFERENCES: AppPreferences = {
  emailAlerts: true,
  failedAlerts: true,
  renewalAlerts: true,
  weeklyDigest: false,
  smsAlerts: false,
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplateSetting[] = [
  { name: "Renewal Reminder (30 days)", active: true },
  { name: "Renewal Reminder (7 days)", active: true },
  { name: "Overdue Notice", active: true },
  { name: "Welcome Email", active: false },
  { name: "Invoice Issued", active: true },
];

function getStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function saveStoredJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

type DatabaseSettings = {
  accountProfile?: Partial<UserProfile>;
  organizationProfile?: Partial<OrganizationProfile>;
  preferences?: Partial<AppPreferences>;
  emailTemplates?: EmailTemplateSetting[];
};

async function fetchDatabaseSettings(): Promise<DatabaseSettings> {
  const response = await fetch("/api/settings", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const data = await readApiJson(response, "/api/settings");

  if (!response.ok) {
    throw new Error(
      stringValue(
        asRecord(data).message ?? asRecord(data).error,
        "Failed to load settings from the database.",
      ),
    );
  }

  return asRecord(data).settings as DatabaseSettings;
}

async function saveDatabaseSetting<T>(key: keyof DatabaseSettings, value: T) {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ key, value }),
  });

  const data = await readApiJson(response, "/api/settings");

  if (!response.ok) {
    throw new Error(
      stringValue(
        asRecord(data).message ?? asRecord(data).error,
        `Failed to save ${key}.`,
      ),
    );
  }

  return data;
}
// ─── Mock Data (Mauritius) ────────────────────────────────────────────────────

const INIT_CLIENTS: Client[] = [
  { id: "c1", company: "Nexus Corp Ltd", contact: "Sarah Appasamy", email: "s.appasamy@nexus.mu", phone: "+230 5923 4567", status: "Active", billingAddress: "Level 3, Nexus Tower, Ebène Cybercity, 72201", totalOutstanding: 480000, overdueAmount: 0, nextRenewal: "2025-08-15", contracts: 3, joinDate: "2022-03-10" },
  { id: "c2", company: "BluePeak Holdings", contact: "Marcus Duval", email: "m.duval@bluepeak.mu", phone: "+230 5834 7801", status: "Due Soon", billingAddress: "7 Royal Road, Curepipe, 74101", totalOutstanding: 850000, overdueAmount: 42000, nextRenewal: "2025-07-28", contracts: 5, joinDate: "2021-06-01" },
  { id: "c3", company: "Meridian Finance", contact: "Aisha Jeetoo", email: "a.jeetoo@meridianfin.mu", phone: "+230 5712 3490", status: "Overdue", billingAddress: "Harbour Front Building, Port Louis, 11328", totalOutstanding: 225000, overdueAmount: 65000, nextRenewal: "2025-07-05", contracts: 2, joinDate: "2020-11-22" },
  { id: "c4", company: "Solaris Tech", contact: "Bongani Mootoosamy", email: "b.mootoosamy@solaristech.mu", phone: "+230 5456 7890", status: "Active", billingAddress: "22 Innovation Hub, Quatre Bornes, 72201", totalOutstanding: 360000, overdueAmount: 0, nextRenewal: "2025-09-10", contracts: 4, joinDate: "2023-01-15" },
  { id: "c5", company: "Coastal Logistics", contact: "Zanele Ramtohul", email: "z.ramtohul@coastallog.mu", phone: "+230 5234 5678", status: "On Track", billingAddress: "Caudan Waterfront, Port Louis, 11307", totalOutstanding: 180000, overdueAmount: 0, nextRenewal: "2025-10-01", contracts: 2, joinDate: "2022-08-30" },
  { id: "c6", company: "Vantage Media", contact: "Lerato Seechurn", email: "l.seechurn@vantagemedia.mu", phone: "+230 5678 9012", status: "Active", billingAddress: "88 Edith Cavell St, Rose Hill, 71461", totalOutstanding: 320000, overdueAmount: 0, nextRenewal: "2025-11-20", contracts: 3, joinDate: "2021-12-05" },
  { id: "c7", company: "TerraGrow Agri", contact: "Frans Boodhoo", email: "f.boodhoo@terragrow.mu", phone: "+230 5345 6789", status: "Cancelled", billingAddress: "Plaine Magnien, Grand Port, 51509", totalOutstanding: 0, overdueAmount: 0, nextRenewal: "—", contracts: 0, joinDate: "2019-04-17" },
  { id: "c8", company: "Pinnacle Insurance", contact: "Nomsa Lallah", email: "n.lallah@pinnacle.mu", phone: "+230 5901 2345", status: "Due Soon", billingAddress: "10 Dr Ferrière St, Port Louis, 11328", totalOutstanding: 1200000, overdueAmount: 98000, nextRenewal: "2025-07-30", contracts: 6, joinDate: "2020-09-14" },
];

const INIT_CONTACTS: Contact[] = [
  { id: "ct1", name: "Sarah Appasamy", company: "Nexus Corp Ltd", role: "Finance Director", email: "s.appasamy@nexus.mu", phone: "+230 5923 4567", status: "Active", lastContact: "2025-07-01", notes: "Prefers email. Decision maker for all renewals." },
  { id: "ct2", name: "Marcus Duval", company: "BluePeak Holdings", role: "CEO", email: "m.duval@bluepeak.mu", phone: "+230 5834 7801", status: "Active", lastContact: "2025-06-28", notes: "Call before 10am. Very responsive." },
  { id: "ct3", name: "Aisha Jeetoo", company: "Meridian Finance", role: "Accounts Manager", email: "a.jeetoo@meridianfin.mu", phone: "+230 5712 3490", status: "Overdue", lastContact: "2025-06-15", notes: "Has flagged budget constraints. Escalate to supervisor." },
  { id: "ct4", name: "Bongani Mootoosamy", company: "Solaris Tech", role: "CTO", email: "b.mootoosamy@solaristech.mu", phone: "+230 5456 7890", status: "Active", lastContact: "2025-07-03", notes: "Technical queries only. CC procurement for contracts." },
  { id: "ct5", name: "Zanele Ramtohul", company: "Coastal Logistics", role: "Operations Manager", email: "z.ramtohul@coastallog.mu", phone: "+230 5234 5678", status: "Active", lastContact: "2025-06-20", notes: "Excellent payer. Easy to work with." },
  { id: "ct6", name: "Lerato Seechurn", company: "Vantage Media", role: "Marketing Director", email: "l.seechurn@vantagemedia.mu", phone: "+230 5678 9012", status: "Active", lastContact: "2025-07-05", notes: "Interested in upgrading service tier." },
  { id: "ct7", name: "Nomsa Lallah", company: "Pinnacle Insurance", role: "Procurement Head", email: "n.lallah@pinnacle.mu", phone: "+230 5901 2345", status: "Active", lastContact: "2025-06-29", notes: "Requires 30-day notice for renewals." },
  { id: "ct8", name: "Frans Boodhoo", company: "TerraGrow Agri", role: "Owner", email: "f.boodhoo@terragrow.mu", phone: "+230 5345 6789", status: "Cancelled", lastContact: "2025-05-10", notes: "Contract ended. Possible re-engagement Q3 2026." },
];

const INIT_CONTRACTS: Contract[] = [
  { id: "con1", name: "Annual Maintenance Contract", clientId: "c1", client: "Nexus Corp Ltd", reference: "NX-2024-001", serviceDescription: "Full server and network infrastructure maintenance including hardware support and remote monitoring across all Port Louis offices.", startDate: "2024-08-15", renewalDate: "2025-08-15", amount: 480000, currency: "MUR", assignedTo: "James Osei", status: "Active", contractType: "Maintenance", daysLeft: 38, autoRenew: true, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: true, scheduledDate: "2025-05-17" }, { days: 60, sent: true, scheduledDate: "2025-06-16" }, { days: 30, sent: true, scheduledDate: "2025-07-16" }, { days: 14, sent: false, scheduledDate: "2025-08-01" }, { days: 7, sent: false, scheduledDate: "2025-08-08" }, { days: 0, sent: false, scheduledDate: "2025-08-15" }], recipientTypes: ["primary", "staff"], notes: ["Client requested submission. Following up for confirmation. — Staff Member | 02 Jan 2025 10:36 AM"] },
  { id: "con2", name: "Software Licensing Agreement", clientId: "c2", client: "BluePeak Holdings", reference: "BP-2024-002", serviceDescription: "Enterprise software licensing for 150 users including ERP, CRM and productivity suite modules.", startDate: "2024-07-28", renewalDate: "2025-07-28", amount: 850000, currency: "MUR", assignedTo: "James Osei", status: "Due Soon", contractType: "Licensing", daysLeft: 20, autoRenew: false, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: true, scheduledDate: "2025-04-29" }, { days: 60, sent: true, scheduledDate: "2025-05-29" }, { days: 30, sent: true, scheduledDate: "2025-06-28" }, { days: 14, sent: true, scheduledDate: "2025-07-14" }, { days: 7, sent: false, scheduledDate: "2025-07-21" }, { days: 0, sent: false, scheduledDate: "2025-07-28" }], recipientTypes: ["primary", "secondary", "staff"], notes: [] },
  { id: "con3", name: "IT Support Retainer", clientId: "c3", client: "Meridian Finance", reference: "MF-2023-003", serviceDescription: "Monthly IT support retainer covering helpdesk, on-site visits and incident management for the Port Louis head office.", startDate: "2023-07-05", renewalDate: "2025-07-05", amount: 225000, currency: "MUR", assignedTo: "Priya Naidoo", status: "Overdue", contractType: "Support", daysLeft: -3, autoRenew: false, renewalFrequency: "Yearly", noticePeriod: "14 days", reminders: [{ days: 90, sent: true }, { days: 60, sent: true }, { days: 30, sent: true }, { days: 14, sent: true }, { days: 7, sent: true }, { days: 0, sent: true }], recipientTypes: ["primary"], notes: ["Called Aisha — no response. Sent follow-up email. — Priya Naidoo | 06 Jul 2025 09:15 AM"] },
  { id: "con4", name: "Cloud Infrastructure Services", clientId: "c4", client: "Solaris Tech", reference: "ST-2024-004", serviceDescription: "Managed cloud hosting, backup and disaster recovery services for all Solaris Tech production workloads.", startDate: "2024-09-10", renewalDate: "2025-09-10", amount: 360000, currency: "MUR", assignedTo: "Priya Naidoo", status: "Active", contractType: "Service", daysLeft: 64, autoRenew: true, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: true }, { days: 60, sent: false }, { days: 30, sent: false }, { days: 14, sent: false }, { days: 7, sent: false }, { days: 0, sent: false }], recipientTypes: ["primary", "staff"], notes: [] },
  { id: "con5", name: "Network Maintenance", clientId: "c5", client: "Coastal Logistics", reference: "CL-2024-005", serviceDescription: "Quarterly network infrastructure review and maintenance across all warehouse sites in Port Louis and Mahebourg.", startDate: "2024-10-01", renewalDate: "2025-10-01", amount: 180000, currency: "MUR", assignedTo: "Thabo Radebe", status: "Active", contractType: "Maintenance", daysLeft: 85, autoRenew: true, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: false }, { days: 60, sent: false }, { days: 30, sent: false }, { days: 14, sent: false }, { days: 7, sent: false }, { days: 0, sent: false }], recipientTypes: ["primary"], notes: [] },
  { id: "con6", name: "Digital Marketing Platform", clientId: "c6", client: "Vantage Media", reference: "VM-2024-006", serviceDescription: "Full digital marketing platform access including analytics, campaign management, and social media scheduling tools.", startDate: "2024-11-20", renewalDate: "2025-11-20", amount: 320000, currency: "MUR", assignedTo: "James Osei", status: "Active", contractType: "Service", daysLeft: 135, autoRenew: false, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: false }, { days: 60, sent: false }, { days: 30, sent: false }, { days: 14, sent: false }, { days: 7, sent: false }, { days: 0, sent: false }], recipientTypes: ["primary", "staff"], notes: [] },
  { id: "con7", name: "Managed Insurance Systems", clientId: "c8", client: "Pinnacle Insurance", reference: "PI-2024-007", serviceDescription: "End-to-end managed services for insurance policy processing systems, claims management and compliance reporting.", startDate: "2024-07-30", renewalDate: "2025-07-30", amount: 1200000, currency: "MUR", assignedTo: "James Osei", status: "Due Soon", contractType: "Service", daysLeft: 22, autoRenew: false, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: true }, { days: 60, sent: true }, { days: 30, sent: true }, { days: 14, sent: true }, { days: 7, sent: false }, { days: 0, sent: false }], recipientTypes: ["primary", "secondary", "staff"], notes: ["Nomsa confirmed renewal meeting set for 20 July. — James Osei | 01 Jul 2025 02:10 PM"] },
  { id: "con8", name: "Agricultural Software License", clientId: "c7", client: "TerraGrow Agri", reference: "TG-2023-008", serviceDescription: "Farm management and inventory software license for the Plaine Magnien estate.", startDate: "2023-04-17", renewalDate: "2024-04-17", amount: 96000, currency: "MUR", assignedTo: "Thabo Radebe", status: "Cancelled", contractType: "Licensing", daysLeft: -450, autoRenew: false, renewalFrequency: "Yearly", noticePeriod: "30 days", reminders: [{ days: 90, sent: true }, { days: 60, sent: true }, { days: 30, sent: true }, { days: 14, sent: true }, { days: 7, sent: true }, { days: 0, sent: true }], recipientTypes: ["primary"], notes: [] },
];

const INIT_NOTIFICATIONS: Notification[] = [
  { id: "n1", title: "Contract Overdue — Meridian Finance", message: "IT Support Retainer (MF-2023-003) was due on 5 July 2025. Immediate action required.", time: "2 hours ago", read: false, archived: false, type: "overdue", detail: "The Meridian Finance IT Support Retainer (Rs 225,000) expired on 5 July 2025. Assigned to Priya Naidoo. Please contact Aisha Jeetoo at a.jeetoo@meridianfin.mu immediately. Late fees may apply after 14 days." },
  { id: "n2", title: "Due Soon — BluePeak Holdings", message: "Software Licensing Agreement (BP-2024-002) is due in 20 days (28 July 2025).", time: "5 hours ago", read: false, archived: false, type: "renewal", detail: "The BluePeak Holdings Software Licensing Agreement (Rs 850,000) is due on 28 July 2025. James Osei is the assigned account manager. Contact: Marcus Duval, m.duval@bluepeak.mu." },
  { id: "n3", title: "Due Soon — Pinnacle Insurance", message: "Managed Insurance Systems (PI-2024-007) is due in 22 days (30 July 2025).", time: "6 hours ago", read: true, archived: false, type: "renewal", detail: "Pinnacle Insurance Managed Insurance Systems (Rs 1,200,000) renews on 30 July 2025. Nomsa Lallah requires 30-day notice. Renewal meeting confirmed for 20 July." },
  { id: "n4", title: "Reminder Sent — Nexus Corp", message: "30-day renewal reminder sent for Annual Maintenance Contract.", time: "1 day ago", read: true, archived: false, type: "info", detail: "The 30-day automated reminder email was sent to Sarah Appasamy (s.appasamy@nexus.mu) for the Annual Maintenance Contract (NX-2024-001) renewing on 15 August 2025." },
  { id: "n5", title: "High Value Alert — Pinnacle Insurance", message: "Total outstanding for Pinnacle Insurance has exceeded Rs 1,000,000.", time: "2 days ago", read: true, archived: false, type: "alert", detail: "Pinnacle Insurance currently has Rs 1,200,000 in total outstanding contracts, exceeding the Rs 1,000,000 alert threshold. Overdue amount: Rs 98,000." },
  { id: "n6", title: "Email Bounce — Meridian Finance", message: "Renewal reminder email to a.jeetoo@meridianfin.mu bounced. Check contact details.", time: "3 days ago", read: true, archived: true, type: "alert", detail: "An automated renewal reminder sent to a.jeetoo@meridianfin.mu on 5 July 2025 returned a permanent bounce (550 error). Please verify the email address and resend manually." },
];

const BAR_DATA = [
  { month: "Feb", renewals: 8 }, { month: "Mar", renewals: 12 },
  { month: "Apr", renewals: 7 }, { month: "May", renewals: 15 },
  { month: "Jun", renewals: 11 }, { month: "Jul", renewals: 9 },
];

const PIE_DATA = [
  { name: "Active",    value: 35, color: "var(--chart-2)" },
  { name: "Due Soon", value: 30, color: "var(--chart-3)" },
  { name: "On Track", value: 20, color: "var(--chart-1)" },
  { name: "Overdue",  value: 9,  color: "var(--chart-4)" },
  { name: "Cancelled",value: 6,  color: "var(--chart-5)" },
];

const STAFF_MEMBERS = ["James Osei", "Priya Naidoo", "Thabo Radebe", "Kavya Patel", "Marc Legris"];
const CONTRACT_TYPES = ["Service", "Support", "Maintenance", "Licensing"];
const CURRENCIES = ["MUR", "USD", "EUR", "GBP", "ZAR"];

// ─── Utilities ────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

function calcDaysLeft(renewalDate: string): number {
  const diff = new Date(renewalDate).getTime() - new Date().getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function fmtCurrency(amount: number, currency: string): string {
  if (currency === "MUR") return `Rs ${amount.toLocaleString()}`;
  const symbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", ZAR: "R" };
  return `${symbols[currency] || currency} ${amount.toLocaleString()}`;
}


async function readApiJson(response: Response, apiName: string) {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const preview = text.replace(/\s+/g, " ").slice(0, 160);

    throw new Error(
      `${apiName} did not return JSON. Status: ${response.status}. Check that this API route exists and is not returning an HTML error page. Preview: ${preview}`
    );
  }

  return response.json();
}


type ApiRecord = Record<string, unknown>;

type DatabaseClient = {
  id?: string;
  company?: string;
  companyName?: string;
  contact?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  billingAddress?: string | null;
  contacts?: unknown[];
  contracts?: unknown[] | number;
  status?: unknown;
  totalOutstanding?: number | string | null;
  overdueAmount?: number | string | null;
  nextRenewal?: string | null;
  joinDate?: string | null;
  createdAt?: string | null;
};

type DatabaseContact = {
  id?: string;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: unknown;
  lastContact?: string | null;
  notes?: string | null;
  clientId?: string | null;
  client?: unknown;
  createdAt?: string | null;
};

type DatabaseContract = {
  id?: string;
  name?: string | null;
  contractName?: string | null;
  clientId?: string | null;
  client?: unknown;
  reference?: string | null;
  serviceDescription?: string | null;
  startDate?: string | Date | null;
  renewalDate?: string | Date | null;
  amount?: number | string | null;
  value?: number | string | null;
  currency?: string | null;
  assignedTo?: string | null;
  status?: unknown;
  contractType?: string | null;
  autoRenew?: boolean | null;
  renewalFrequency?: Contract["renewalFrequency"] | null;
  noticePeriod?: string | null;
  reminders?: ContractReminder[] | null;
  recipientTypes?: string[] | null;
  notes?: string[] | null;
  contractValue?: number | string | null;
  autoRenewal?: boolean | null;
};

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === "object" ? (value as ApiRecord) : {};
}

function stringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function dateOnly(value: unknown, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) return stringValue(value, fallback);
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(value: unknown, fallback: Status = "Active"): Status {
  const raw = stringValue(value, fallback).trim();

  const normalized = raw
    .toUpperCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");

  if (normalized === "ACTIVE") return "Active";
  if (normalized === "PENDING") return "Pending";
  if (normalized === "OVERDUE") return "Overdue";
  if (normalized === "DUE_SOON") return "Due Soon";
 if (normalized === "EXPIRING_SOON") return "Due Soon";
  if (normalized === "CANCELLED") return "Cancelled";
  if (normalized === "ON_TRACK") return "On Track";
  if (normalized === "RENEWED") return "Renewed";
  if (normalized === "ON_HOLD") return "On Hold";

  return fallback;
}

function listFromApi(data: unknown, key: string): unknown[] {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  const value = record[key];
  return Array.isArray(value) ? value : [];
}

function itemFromApi(data: unknown, key: string): unknown {
  const record = asRecord(data);
  return record[key] ?? data;
}

function normalizeClient(raw: unknown): Client {
  const record = asRecord(raw) as DatabaseClient;
  const contacts = Array.isArray(record.contacts) ? record.contacts : [];
  const firstContact = asRecord(contacts[0]);
  const contractsValue = record.contracts;
  const company = stringValue(record.company, stringValue(record.companyName, "Unnamed Client"));

  return {
    id: stringValue(record.id, `client-${Math.random().toString(36).slice(2, 10)}`),
    company,
    contact: stringValue(record.contact, stringValue(firstContact.name, "No contact")),
    email: stringValue(record.email, stringValue(firstContact.email, "")),
    phone: stringValue(record.phone, stringValue(firstContact.phone, "")),
    status: normalizeStatus(record.status, "Active"),
    billingAddress: stringValue(record.billingAddress, stringValue(record.address, "Unknown address")),
    totalOutstanding: numberValue(record.totalOutstanding, 0),
    overdueAmount: numberValue(record.overdueAmount, 0),
    nextRenewal: stringValue(record.nextRenewal, "TBD"),
    contracts: Array.isArray(contractsValue)
      ? contractsValue.length
      : typeof contractsValue === "number"
        ? contractsValue
        : 0,
    joinDate: dateOnly(record.joinDate ?? record.createdAt, new Date().toISOString().slice(0, 10)),
  };
}

function normalizeContact(raw: unknown): Contact {
  const record = asRecord(raw) as DatabaseContact;
  const client = asRecord(record.client);

  return {
    id: stringValue(record.id, `contact-${Math.random().toString(36).slice(2, 10)}`),
    name: stringValue(record.name, "Unnamed Contact"),
    company: stringValue(record.company, stringValue(client.companyName, stringValue(client.company, "Unknown Company"))),
    role: stringValue(record.role, ""),
    email: stringValue(record.email, ""),
    phone: stringValue(record.phone, ""),
    status: normalizeStatus(record.status, "Active"),
    lastContact: dateOnly(record.lastContact ?? record.createdAt, new Date().toISOString().slice(0, 10)),
    notes: stringValue(record.notes, ""),
  };
}

function normalizeContract(raw: unknown): Contract {
  const record = asRecord(raw) as DatabaseContract;
  const clientRecord = asRecord(record.client);
  const renewalDate = dateOnly(record.renewalDate, "");
  const daysLeft = renewalDate ? calcDaysLeft(renewalDate) : 0;

  const clientName = stringValue(
    record.client,
    stringValue(
      clientRecord.companyName,
      stringValue(clientRecord.company, "Unknown Client"),
    ),
  );

  const rawContractType = stringValue(record.contractType, "Service")
    .toLowerCase()
    .replaceAll("_", " ");

  const contractType =
    rawContractType.charAt(0).toUpperCase() + rawContractType.slice(1);

  const rawReminders = Array.isArray(record.reminders)
    ? record.reminders
    : [];

  const reminders: ContractReminder[] = rawReminders.map((reminder) => {
    const reminderRecord = asRecord(reminder);
    const scheduledValue =
      reminderRecord.scheduledDate ?? reminderRecord.sentAt ?? undefined;

    return {
      days: numberValue(reminderRecord.days ?? reminderRecord.daysBefore, 0),
      sent: Boolean(reminderRecord.sent),
      ...(scheduledValue
        ? {
            scheduledDate: dateOnly(scheduledValue, ""),
          }
        : {}),
    };
  });

  const rawNotes = Array.isArray(record.notes) ? record.notes : [];

  const notes = rawNotes
    .map((note) => {
      if (typeof note === "string") return note;

      const noteRecord = asRecord(note);

      return stringValue(noteRecord.note, "");
    })
    .filter(Boolean);

  return {
    id: stringValue(
      record.id,
      `contract-${Math.random().toString(36).slice(2, 10)}`,
    ),
    name: stringValue(
      record.name,
      stringValue(record.contractName, "Untitled Contract"),
    ),
    clientId: stringValue(record.clientId, stringValue(clientRecord.id, "")),
    client: clientName,
    reference: stringValue(record.reference, "—"),
    serviceDescription: stringValue(record.serviceDescription, ""),
    startDate: dateOnly(record.startDate, ""),
    renewalDate,
    amount: numberValue(record.amount ?? record.value ?? record.contractValue, 0),
    currency: stringValue(record.currency, "MUR"),
    assignedTo: stringValue(record.assignedTo, ""),
    status: normalizeStatus(
      record.status,
      daysLeft < 0 ? "Overdue" : daysLeft <= 30 ? "Due Soon" : "Active",
    ),
    contractType,
    daysLeft,
    autoRenew: Boolean(record.autoRenew ?? record.autoRenewal),
    renewalFrequency: record.renewalFrequency ?? "Yearly",
    noticePeriod: stringValue(record.noticePeriod, "30 days"),
    reminders,
    recipientTypes: Array.isArray(record.recipientTypes)
      ? record.recipientTypes.map(String)
      : [],
    notes,
  };
}
function buildNotificationsFromContracts(
  contracts: Contract[],
  overrides: Record<string, NotificationOverride>,
): Notification[] {
  return contracts
    .filter((contract) => {
      return (
        contract.status !== "Cancelled" &&
        contract.status !== "Renewed" &&
        contract.status !== "On Hold"
      );
    })
    .flatMap((contract) => {
      const notifications: Notification[] = [];

      const reference =
        contract.reference && contract.reference !== "—"
          ? ` (${contract.reference})`
          : "";

      if (contract.daysLeft < 0 || contract.status === "Overdue") {
        notifications.push({
          id: `contract-${contract.id}-overdue`,
          title: `Contract Overdue — ${contract.client}`,
          message: `${contract.name}${reference} was due on ${contract.renewalDate}. Immediate action required.`,
          time: "Auto-generated",
          read: false,
          archived: false,
          type: "overdue",
          detail: `${contract.name}${reference} for ${contract.client} is overdue by ${Math.abs(
            contract.daysLeft,
          )} day${Math.abs(contract.daysLeft) === 1 ? "" : "s"}. Renewal date was ${
            contract.renewalDate
          }. Assigned staff: ${contract.assignedTo || "Not assigned"}.`,
        });
      } else if (contract.daysLeft <= 30 || contract.status === "Due Soon") {
        notifications.push({
          id: `contract-${contract.id}-due-soon`,
          title:
            contract.daysLeft === 0
              ? `Due Today — ${contract.client}`
              : `Due Soon — ${contract.client}`,
          message:
            contract.daysLeft === 0
              ? `${contract.name}${reference} is due today.`
              : `${contract.name}${reference} is due in ${contract.daysLeft} day${
                  contract.daysLeft === 1 ? "" : "s"
                } (${contract.renewalDate}).`,
          time: "Auto-generated",
          read: false,
          archived: false,
          type: "renewal",
          detail: `${contract.name}${reference} for ${contract.client} renews on ${
            contract.renewalDate
          }. Value: ${fmtCurrency(contract.amount, contract.currency)}. Assigned staff: ${
            contract.assignedTo || "Not assigned"
          }.`,
        });
      }

      return notifications;
    })
    .map((notification) => {
      const override = overrides[notification.id];

      return {
        ...notification,
        read: override?.read ?? notification.read,
        archived: override?.archived ?? notification.archived,
        deleted: override?.deleted,
      } as Notification & { deleted?: boolean };
    })
    .filter((notification) => !notification.deleted);
}

function statusColor(status: Status): string {
  const map: Record<Status, string> = {
    Active: "bg-zinc-900 text-white",
    "On Track": "bg-zinc-700 text-white",
    "Due Soon": "bg-amber-500 text-white",
    Overdue: "bg-red-600 text-white",
    Cancelled: "bg-zinc-200 text-zinc-600",
    Pending: "bg-zinc-300 text-zinc-800",
    Renewed: "bg-emerald-600 text-white",
    "On Hold": "bg-zinc-400 text-white",
  };
  return map[status] ?? "bg-zinc-200 text-zinc-700";
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor(status)}`}>
      {status === "Overdue" && <AlertTriangle className="w-3 h-3" />}
      {status}
    </span>
  );
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className}>
      <rect x="2" y="2" width="22" height="6" fill="currentColor" />
      <rect x="2" y="32" width="22" height="6" fill="currentColor" />
      <rect x="2" y="2" width="6" height="36" fill="currentColor" />
      <rect x="14" y="14" width="10" height="12" fill="currentColor" />
      <rect x="28" y="2" width="6" height="6" fill="currentColor" />
      <rect x="34" y="8" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

function RenewalOpsLogo({ size = "md", showText = true, className = "" }: {
  size?: "xs" | "sm" | "md" | "lg" | "xl"; showText?: boolean; className?: string;
}) {
  const sizes = {
    xs: { mark: 20, name: "text-xs", sub: "text-[8px]" },
    sm: { mark: 28, name: "text-sm", sub: "text-[9px]" },
    md: { mark: 36, name: "text-base", sub: "text-[10px]" },
    lg: { mark: 52, name: "text-2xl", sub: "text-xs" },
    xl: { mark: 72, name: "text-4xl", sub: "text-sm" },
  };
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <LogoMark size={s.mark} className="text-foreground shrink-0" />
      {showText && (
        <div className="leading-none">
          <div className={cn("font-black tracking-tight uppercase", s.name)}>RENEWALOPS</div>
          <div className={cn("font-medium tracking-[0.15em] text-muted-foreground uppercase", s.sub)}>Since 2026</div>
        </div>
      )}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium pointer-events-auto",
            "animate-[toastIn_0.3s_ease_both]",
            t.type === "success" ? "bg-zinc-900 text-white" :
            t.type === "error" ? "bg-red-600 text-white" : "bg-zinc-700 text-white"
          )}>
          {t.type === "success" && <CheckCircle className="w-4 h-4 shrink-0" />}
          {t.type === "error" && <XCircle className="w-4 h-4 shrink-0" />}
          {t.type === "info" && <Bell className="w-4 h-4 shrink-0" />}
          {t.message}
          <button onClick={() => remove(t.id)} className="ml-2 opacity-60 hover:opacity-100 transition-opacity">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const remove = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);
  return { toasts, add, remove };
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[200]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative w-24 h-24">
          <svg width="96" height="96" viewBox="0 0 40 40" fill="none" className="text-foreground">
            <rect x="2" y="2" width="22" height="6" fill="currentColor" className="opacity-0" style={{ animation: "blockDrop 0.5s 0.1s ease both", animationFillMode: "forwards" }} />
            <rect x="2" y="32" width="22" height="6" fill="currentColor" className="opacity-0" style={{ animation: "blockDrop 0.5s 0.25s ease both", animationFillMode: "forwards" }} />
            <rect x="2" y="2" width="6" height="36" fill="currentColor" className="opacity-0" style={{ animation: "blockDrop 0.5s 0s ease both", animationFillMode: "forwards" }} />
            <rect x="14" y="14" width="10" height="12" fill="currentColor" className="opacity-0" style={{ animation: "blockDrop 0.5s 0.4s ease both", animationFillMode: "forwards" }} />
            <rect x="28" y="2" width="6" height="6" fill="currentColor" className="opacity-0" style={{ animation: "blockDrop 0.5s 0.55s ease both", animationFillMode: "forwards" }} />
            <rect x="34" y="8" width="6" height="6" fill="currentColor" className="opacity-0" style={{ animation: "blockDrop 0.5s 0.65s ease both", animationFillMode: "forwards" }} />
          </svg>
        </div>
        <div className="text-center opacity-0" style={{ animation: "fadeUp 0.6s 0.8s ease both", animationFillMode: "forwards" }}>
          <div className="font-black tracking-tight uppercase text-2xl">RENEWALOPS</div>
          <div className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase mt-1">Since 2026</div>
        </div>
        <div className="flex gap-1.5 opacity-0" style={{ animation: "fadeUp 0.6s 1s ease both", animationFillMode: "forwards" }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-foreground/40"
              style={{ animation: `dotPulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Login Animation ──────────────────────────────────────────────────────────

// Constellation network — nodes as % of panel width/height
const NET_NODES = [
  { x: 22, y: 14 }, { x: 68, y: 10 }, { x: 44, y: 30 },
  { x: 82, y: 26 }, { x: 14, y: 48 }, { x: 57, y: 46 },
  { x: 88, y: 55 }, { x: 30, y: 65 }, { x: 72, y: 70 },
  { x: 48, y: 80 }, { x: 12, y: 80 }, { x: 78, y: 86 },
  { x: 36, y: 12 }, { x: 62, y: 28 }, { x: 24, y: 90 },
  { x: 55, y: 62 },
];
const NET_EDGES = [
  [0,2],[0,12],[1,2],[1,3],[2,5],[2,12],[3,6],[3,13],
  [4,7],[4,10],[5,6],[5,13],[5,15],[6,8],[7,9],[7,10],
  [8,9],[8,11],[9,14],[12,13],[13,15],[15,8],
];

function LoginAnimation() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none text-background">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {/* Connection lines */}
        {NET_EDGES.map(([a, b], i) => (
          <line key={`e${i}`}
            x1={`${NET_NODES[a].x}%`} y1={`${NET_NODES[a].y}%`}
            x2={`${NET_NODES[b].x}%`} y2={`${NET_NODES[b].y}%`}
            stroke="currentColor" strokeWidth="0.6"
            style={{ animation: `edgePulse 4s ${(i * 0.28) % 3.5}s ease-in-out infinite` }}
          />
        ))}

        {/* Ping rings per node */}
        {NET_NODES.map((n, i) => (
          <circle key={`p${i}`}
            cx={`${n.x}%`} cy={`${n.y}%`} r="4"
            fill="none" stroke="currentColor" strokeWidth="0.8"
            style={{
              transformBox: "fill-box", transformOrigin: "center",
              animation: `nodePing ${3 + (i % 3) * 0.5}s ${(i * 0.38) % 4}s ease-out infinite`
            }}
          />
        ))}

        {/* Core dots */}
        {NET_NODES.map((n, i) => (
          <circle key={`d${i}`}
            cx={`${n.x}%`} cy={`${n.y}%`}
            r={i % 4 === 0 ? 3 : i % 4 === 1 ? 2.5 : 2}
            fill="currentColor"
            style={{ animation: `dotGlow 3s ${(i * 0.3) % 2.5}s ease-in-out infinite` }}
          />
        ))}
      </svg>

      {/* Logo — in front of network, abduction/adduction swing */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ zIndex: 10, animation: "handCycle 5s cubic-bezier(0.4,0,0.6,1) infinite" }}>
        <LogoMark size={340} className="text-background" />
      </div>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function PageWrapper({ children, pageKey }: { children: React.ReactNode; pageKey: string }) {
  return <div key={pageKey} className="page-enter min-h-full min-w-0">{children}</div>;
}

function BackButton({ onClick, label = "Back" }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
      <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-0.5 transition-transform" />
      {label}
    </button>
  );
}
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-8 w-[74px] shrink-0 items-center rounded-full border-2 transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
        checked
          ? "bg-teal-500 border-teal-300 focus:ring-teal-300"
          : "bg-slate-800 border-slate-500 focus:ring-slate-400"
      )}
    >
      <span
        className={cn(
          "absolute text-[11px] font-bold tracking-wide transition-all",
          checked
            ? "left-3 text-white opacity-100"
            : "left-3 text-white/0 opacity-0"
        )}
      >
        ON
      </span>

      <span
        className={cn(
          "absolute text-[11px] font-bold tracking-wide transition-all",
          checked
            ? "right-3 text-white/0 opacity-0"
            : "right-3 text-white opacity-100"
        )}
      >
        OFF
      </span>

      <span
        className={cn(
          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-200",
          checked ? "right-1" : "left-1"
        )}
      />
    </button>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-foreground text-background flex-col justify-between p-14 relative overflow-hidden">
        <LoginAnimation />
        <div className="relative z-10 flex justify-center w-full">
          <span className="text-lg font-black tracking-[0.18em] uppercase text-background/70">
            RenewalOps
          </span>
        </div>
        <p className="relative z-10 text-xs text-background/20">
          © 2026 RenewalOps — Mauritius
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 sm:mb-[100px] flex justify-center sm:justify-end sm:pr-[110px]">
            <RenewalOpsLogo size="md" />
          </div>

          <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
          <p className="text-muted-foreground text-sm mb-8">
            Sign in to your account to continue
          </p>

          <GoogleSignInButton />

          <p className="mt-6 text-xs text-center text-muted-foreground">
            Secure sign-in powered by Clerk.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SIGNUP ───────────────────────────────────────────────────────────────────

function SignupPage({ onBack, onSignup }: { onBack: () => void; onSignup: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  function handle() {
    if (!form.name || !form.email || !form.password) { setError("Please fill in all required fields."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError(""); onSignup();
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex w-1/2 bg-foreground text-background flex-col justify-between p-14 relative overflow-hidden">
        <LoginAnimation />
        <div className="relative z-10 flex justify-center w-full">
          <span className="text-lg font-black tracking-[0.18em] uppercase text-background/70">RenewalOps</span>
        </div>
        <p className="relative z-10 text-xs text-background/20">© 2026 RenewalOps — Mauritius</p>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10 sm:py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-end"><RenewalOpsLogo size="md" /></div>
          <div className="mb-6"><BackButton onClick={onBack} label="Back to Login" /></div>
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-muted-foreground text-sm mb-8">Fill in the details to get started</p>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-500 mb-4">
              <XCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
          <div className="space-y-4">
            {[{ label: "Full name", key: "name", type: "text", placeholder: "John Doe" }, { label: "Email address", key: "email", type: "email", placeholder: "john@company.mu" }].map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium block mb-1.5">{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} type={f.type} placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring transition-all" />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium block mb-1.5">Password</label>
              <div className="relative">
                <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} type={showPass ? "text" : "password"} placeholder="Min. 8 characters"
                  className="w-full px-3 py-2.5 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring pr-10" />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Confirm password</label>
              <input value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} type="password" placeholder="Repeat password"
                className="w-full px-3 py-2.5 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
            </div>
            <button onClick={handle}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all">
              Sign Up
            </button>
          </div>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <button onClick={onBack} className="font-medium text-foreground hover:underline">Login</button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", page: "dashboard" as Page },
  { icon: Users, label: "Clients", page: "clients" as Page },
 // { icon: BookUser, label: "Contacts", page: "contacts" as Page },
  { icon: FileText, label: "Contracts", page: "contracts" as Page },
  { icon: Settings, label: "Settings", page: "settings" as Page },
];
function Sidebar({
  current,
  onNav,
  onSignOut,
  userProfile,
  mobileOpen,
  onClose,
}: {
  current: Page;
  onNav: (p: Page) => void;
  onSignOut: () => void;
  userProfile: { name: string; email: string; phone: string; role: string };
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const isActive = (page: Page) => {
    if (page === "clients") return current === "clients" || current === "client-detail";
   // if (page === "contacts") return current === "contacts" || current === "contact-detail";
    if (page === "contracts") return current === "contracts" || current === "contract-detail";
    if (page === "settings") return current === "settings" || current.startsWith("settings-");
    return current === page;
  };

  const initials =
    userProfile.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  function navTo(page: Page) {
    onNav(page);
    onClose();
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm xl:hidden"
        />
      )}
<aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-[100dvh] w-[min(16rem,85vw)] xl:w-60 flex-col bg-sidebar border-r border-border shadow-2xl xl:shadow-none",
          "transition-transform duration-200 ease-out will-change-transform",
          "xl:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-border gap-3">
          <div className="relative shrink-0 flex items-center justify-center w-9 h-9">
            <div
              className="absolute inset-0 rounded-md border border-foreground/25"
              style={{ animation: "logoRing 3s ease-in-out infinite" }}
            />
            <div
              className="absolute inset-0 rounded-md border border-foreground/10"
              style={{ animation: "logoRing 3s 1.5s ease-in-out infinite" }}
            />
            <LogoMark size={22} className="text-foreground relative z-10" />
          </div>

          <div className="leading-none select-none min-w-0">
            <div className="font-black tracking-tight uppercase text-sm">RENEWALOPS</div>
            <div className="font-medium tracking-[0.12em] text-muted-foreground uppercase text-[9px]">
              Since 2026
            </div>
          </div>

          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-md hover:bg-accent text-muted-foreground xl:hidden"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, label, page }) => (
            <button
              key={page}
              onClick={() => navTo(page)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive(page)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          <div className="rounded-xl border border-border bg-card p-3">
            <button
              onClick={() => navTo("admin")}
              className="w-full flex items-center gap-3 text-left rounded-lg hover:bg-accent transition-colors p-2"
            >
              <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{userProfile.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{userProfile.email}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{userProfile.role}</p>
              </div>
            </button>

            <button
              onClick={onSignOut}
              className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────

function TopBar({
  onSearch,
  searchQuery,
  setSearchQuery,
  onNotifications,
  notifCount,
  onAdmin,
  userProfile,
  onMenuClick,
}: {
  onSearch: () => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  onNotifications: () => void;
  notifCount: number;
  onAdmin: () => void;
  userProfile: { name: string; email: string; phone: string; role: string };
  onMenuClick: () => void;
}) {
  const initials =
    userProfile.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  return (
    <header className="fixed left-0 xl:left-60 right-0 top-0 h-16 bg-background border-b border-border flex items-center px-3 sm:px-4 xl:px-6 gap-2 sm:gap-4 z-30">
      <button
        onClick={onMenuClick}
        className="xl:hidden p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0 max-w-none xl:max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={onSearch}
          placeholder="Search clients, contacts, contracts…"
          className="w-full pl-9 pr-3 sm:pr-4 py-2 bg-muted rounded-md text-sm outline-none focus:ring-2 ring-ring transition-all truncate"
        />
      </div>

      <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
        <button
          onClick={onNotifications}
          className="relative p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Bell className="w-4 h-4" />
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        <button
          onClick={onAdmin}
          className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold hover:opacity-80 transition-opacity"
        >
          {initials}
        </button>
      </div>
    </header>
  );
}

// ─── SEARCH OVERLAY ───────────────────────────────────────────────────────────

function SearchOverlay({ query, clients, contacts, contracts, onClose, onNav }: {
  query: string;
  clients: Client[];
  contacts: Contact[];
  contracts: Contract[];
  onClose: () => void;
  onNav: (p: Page) => void;
}) {
  const q = query.toLowerCase();

  const clientRes = clients.filter(c =>
    c.company.toLowerCase().includes(q) ||
    c.contact.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q)
  );

  const contactRes = contacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.company.toLowerCase().includes(q) ||
    c.email.toLowerCase().includes(q)
  );

  const contractRes = contracts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.client.toLowerCase().includes(q) ||
    c.reference.toLowerCase().includes(q)
  );

  if (!query) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-3 sm:px-4" onClick={onClose}>
      <div className="bg-popover border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {clientRes.length === 0 && contactRes.length === 0 && contractRes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No results for &ldquo;{query}&rdquo;</div>
        ) : (
          <div className="p-2">
            {clientRes.length > 0 && <>
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Clients</p>
              {clientRes.map(c => (
                <button key={c.id} onClick={() => { onNav("clients"); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left transition-colors">
                  <Building className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{c.company}</span>
                  <span className="text-muted-foreground ml-auto">{c.contact}</span>
                </button>
              ))}
            </>}

            {contactRes.length > 0 && <>
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contacts</p>
              {contactRes.map(c => (
                <button key={c.id} onClick={() => { onNav("contacts"); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left transition-colors">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-auto">{c.company}</span>
                </button>
              ))}
            </>}

            {contractRes.length > 0 && <>
              <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contracts</p>
              {contractRes.map(c => (
                <button key={c.id} onClick={() => { onNav("contracts"); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent text-sm text-left transition-colors">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-auto">{c.client}</span>
                </button>
              ))}
            </>}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── SIGN OUT MODAL ───────────────────────────────────────────────────────────

function SignOutModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <LogOut className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
        <h2 className="font-bold text-lg text-center mb-1">Sign out?</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">You will be returned to the login screen.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Sign Out</button>
        </div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const STATUS_CHART_COLORS: Record<string, string> = {
  Active: "#54C7A5",
  "On Track": "#30B7AE",
  "Due Soon": "#6AA6D8",
  Overdue: "#EF4444",
  Cancelled: "#94A3B8",
  Renewed: "#22C55E",
  "On Hold": "#F59E0B",
  Pending: "#A3A3A3",
};

function buildStatusChart(contracts: Contract[]) {
  const statuses: Status[] = [
    "Active",
    "On Track",
    "Due Soon",
    "Overdue",
    "Cancelled",
    "Renewed",
    "On Hold",
    "Pending",
  ];

  return statuses
    .map((status) => {
      const count = contracts.filter((contract) => contract.status === status).length;

      return {
        name: status,
        count,
        color: STATUS_CHART_COLORS[status] ?? "#94A3B8",
      };
    })
    .filter((item) => item.count > 0);
}

function buildMonthlyRenewals(contracts: Contract[]) {
  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const currentYear = new Date().getFullYear();

  return monthLabels.map((month, index) => {
    const count = contracts.filter((contract) => {
      if (!contract.renewalDate || contract.renewalDate === "—") return false;

      const date = new Date(contract.renewalDate);

      return date.getFullYear() === currentYear && date.getMonth() === index;
    }).length;

    return {
      month,
      count,
    };
  });
}

function DashboardPage({ clients, contracts, onNav }: { clients: Client[]; contracts: Contract[]; onNav: (p: Page) => void }) {
  const dueCount = contracts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 30 && c.status !== "Cancelled" && c.status !== "Renewed").length;
  const overdueCount = contracts.filter(c => c.daysLeft < 0 && c.status !== "Cancelled" && c.status !== "Renewed").length;
  const byType = CONTRACT_TYPES.map(t => ({ type: t, count: contracts.filter(c => c.contractType === t).length }));

  const statusChartData = buildStatusChart(contracts);
  const statusChartTotal = contracts.length;

  const monthlyRenewals = buildMonthlyRenewals(contracts);
  const maxMonthlyRenewals = Math.max(1, ...monthlyRenewals.map((item) => item.count));

  const upcomingContracts = contracts
    .filter(c => c.status !== "Cancelled")
    .sort((a, b) => new Date(a.renewalDate).getTime() - new Date(b.renewalDate).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your renewal pipeline — Mauritius</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Clients", value: clients.length, sub: "registered companies" },
          { label: "Active Contracts", value: contracts.filter(c => c.status === "Active" || c.status === "On Track").length, sub: "in pipeline" },
          { label: "Due Soon", value: dueCount, sub: "within 30 days" },
          { label: "Overdue", value: overdueCount, sub: "require attention", crit: overdueCount > 0 },
        ].map(s => (
          <div key={s.label} className={cn("bg-card border rounded-xl p-5", s.crit ? "border-red-400/50" : "border-border")}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">{s.label}</p>
            <p className={cn("text-3xl font-bold", s.crit ? "text-red-500" : "")}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
          <h2 className="font-semibold mb-4">Monthly Renewals</h2>

          {contracts.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
              No contract renewal data yet
            </div>
          ) : (
            <div className="h-[220px] flex items-end gap-4 border-b border-border px-2">
              {monthlyRenewals.map((item) => (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "w-full max-w-[90px] rounded-t-lg transition-all",
                      item.count > 0 ? "bg-primary" : "bg-muted"
                    )}
                    style={{
                      height: item.count > 0
                        ? `${Math.max(8, (item.count / maxMonthlyRenewals) * 180)}px`
                        : "4px",
                    }}
                    title={`${item.count} renewal${item.count !== 1 ? "s" : ""}`}
                  />

                  <span className="text-xs text-muted-foreground">{item.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Renewals by Status</h2>

          {statusChartTotal === 0 ? (
            <div className="h-[220px] flex flex-col items-center justify-center text-center">
              <div className="w-[140px] h-[140px] rounded-full border-[20px] border-muted flex items-center justify-center mb-4">
                <div>
                  <p className="text-xl font-bold">0</p>
                  <p className="text-[10px] text-muted-foreground">contracts</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">No renewal status data yet</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                {(() => {
                  const r = 54;
                  const cx = 70;
                  const cy = 70;
                  const sw = 20;
                  const circ = 2 * Math.PI * r;
                  let cum = 0;

                  return (
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      {statusChartData.map((item) => {
                        const pct = item.count / statusChartTotal;
                        const dash = pct * circ;
                        const offset = -(cum * circ);

                        cum += pct;

                        return (
                          <circle
                            key={item.name}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            strokeWidth={sw}
                            strokeDasharray={`${dash} ${circ}`}
                            strokeDashoffset={offset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                            style={{ stroke: item.color }}
                          />
                        );
                      })}

                      <text
                        x={cx}
                        y={cy - 4}
                        textAnchor="middle"
                        fontSize="18"
                        fontWeight="700"
                        fill="var(--foreground)"
                      >
                        {statusChartTotal}
                      </text>

                      <text
                        x={cx}
                        y={cy + 12}
                        textAnchor="middle"
                        fontSize="9"
                        fill="var(--muted-foreground)"
                      >
                        contracts
                      </text>
                    </svg>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                {statusChartData.map((item) => {
                  const percentage = Math.round((item.count / statusChartTotal) * 100);

                  return (
                    <div
                      key={item.name}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: item.color }}
                      />

                      <span>{item.name}</span>

                      <span className="ml-auto font-mono text-foreground">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold">Upcoming Renewals</h2>
          <button onClick={() => onNav("contracts")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Client", "Contract", "Renewal Date", "Days Left", "Status", "Value"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {upcomingContracts.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium">{c.client}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{c.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-mono text-xs">{c.renewalDate}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn("font-semibold font-mono text-xs", c.daysLeft < 0 ? "text-red-500" : c.daysLeft <= 30 ? "text-amber-600" : "text-muted-foreground")}>
                      {c.daysLeft < 0 ? `${Math.abs(c.daysLeft)}d overdue` : `${c.daysLeft}d`}
                    </span>
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  
                  <td className="px-5 py-3.5 font-mono text-xs">{fmtCurrency(c.amount, c.currency)}</td>
                </tr>
              ))}

              {upcomingContracts.length === 0 && (
                <tr>
                 <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No upcoming renewals yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Contracts by Type</h2>
            <button onClick={() => onNav("contracts")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">View all <ArrowRight className="w-3 h-3" /></button>
          </div>
          <div className="space-y-3">
            {byType.map(ct => (
              <div key={ct.type}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium">{ct.type}</span>
                  <span className="text-muted-foreground">{ct.count}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-foreground"
                    style={{ width: contracts.length > 0 ? `${Math.max(5, (ct.count / contracts.length) * 100)}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">Due Renewals</h2>
            <span className="text-2xl font-bold">{dueCount}</span>
          </div>
          {contracts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 30 && c.status !== "Cancelled").map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
              <span className="font-medium truncate">{c.client}</span>
              <span className="text-muted-foreground font-mono ml-2 shrink-0">{c.daysLeft}d</span>
            </div>
          ))}
          {dueCount === 0 && <p className="text-xs text-muted-foreground">No renewals due soon</p>}
          <button onClick={() => onNav("contracts")} className="mt-3 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-card border border-red-400/30 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Overdue</h2>
            <span className="text-2xl font-bold text-red-500">{overdueCount}</span>
          </div>
          {contracts.filter(c => c.daysLeft < 0 && c.status !== "Cancelled" && c.status !== "Renewed").map(c => (
            <div key={c.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
              <span className="font-medium truncate">{c.client}</span>
              <span className="text-red-500 font-mono ml-2 shrink-0">{Math.abs(c.daysLeft)}d</span>
            </div>
          ))}
          {overdueCount === 0 && <p className="text-xs text-muted-foreground">No overdue renewals</p>}
          <button onClick={() => onNav("contracts")} className="mt-3 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}



// ─── CLIENTS PAGE ─────────────────────────────────────────────────────────────

function ClientsPage({ clients, setClients, onDetail, toast }: {
  clients: Client[]; setClients: (c: Client[]) => void;
  onDetail: (c: Client) => void; toast: (msg: string, type?: Toast["type"]) => void;
}) {
  const [filter, setFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({ company: "", contact: "", email: "", phone: "", status: "Active" as Status, billingAddress: "" });

  const filterText = filter.toLowerCase();

  const filtered = clients.filter((c) =>
    String(c.company ?? "").toLowerCase().includes(filterText) ||
    String(c.contact ?? "").toLowerCase().includes(filterText) ||
    String(c.email ?? "").toLowerCase().includes(filterText)
  );

async function handleAdd() {
  if (
    !newClient.company.trim() ||
    !newClient.contact.trim() ||
    !newClient.email.trim()
  ) {
    toast("Please fill in required fields.", "error");
    return;
  }

  try {
    const response = await fetch("/api/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        company: newClient.company,
        companyName: newClient.company,
        contact: newClient.contact,
        email: newClient.email,
        phone: newClient.phone,
        status: newClient.status,
        billingAddress: newClient.billingAddress,
        address: newClient.billingAddress,
      }),
    });

    const data = await readApiJson(response, "/api/clients");

    if (!response.ok) {
      throw new Error(
        stringValue(
          asRecord(data).message ?? asRecord(data).error,
          "Failed to create client.",
        ),
      );
    }

    const createdClient = normalizeClient({
      ...newClient,
      ...asRecord(itemFromApi(data, "client")),
      contact: newClient.contact,
    });

    setClients([createdClient, ...clients]);
    setAddOpen(false);

    setNewClient({
      company: "",
      contact: "",
      email: "",
      phone: "",
      status: "Active",
      billingAddress: "",
    });

    toast("Client added successfully.");
  } catch (error) {
    console.error("Create client frontend error:", error);

    toast(
      error instanceof Error ? error.message : "Failed to create client.",
      "error",
    );
  }
}

  async function handleEdit(updatedClient: Client) {
    if (!updatedClient.id) {
      toast("Client ID is missing.", "error");
      return;
    }

    try {
      const response = await fetch(`/api/clients/${updatedClient.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          company: updatedClient.company,
          companyName: updatedClient.company,
          contact: updatedClient.contact,
          email: updatedClient.email,
          phone: updatedClient.phone,
          status: updatedClient.status,
          billingAddress: updatedClient.billingAddress,
          address: updatedClient.billingAddress,
        }),
      });

      const data = await readApiJson(response, `/api/clients/${updatedClient.id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to update client."));
      }

      const savedClient = normalizeClient({
        ...updatedClient,
        ...asRecord(itemFromApi(data, "client")),
        contact: updatedClient.contact,
      });

      setClients(clients.map((client) => client.id === updatedClient.id ? savedClient : client));
      setEditTarget(null);
      toast("Client updated successfully.");
    } catch (error) {
      console.error("Update client error:", error);
      toast(error instanceof Error ? error.message : "Failed to update client.", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      const data = await readApiJson(response, `/api/clients/${id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to delete client."));
      }

      setClients(clients.filter((client) => client.id !== id));
      setDeleteTarget(null);
      toast("Client deleted from the database.", "info");
    } catch (error) {
      console.error("Delete client error:", error);
      toast(error instanceof Error ? error.message : "Failed to delete client.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage client companies across Mauritius</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter clients…"
          className="w-full pl-9 pr-4 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring transition-all" />
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Company", "Main Contact", "Email", "Status", "Next Renewal", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onDetail(c)}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-bold shrink-0">{c.company?.[0] || "?"}</div>
                      <span className="font-medium">{c.company}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.contact}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.email}</td>
                  <td className="px-5 py-3.5 font-mono text-xs">{fmtCurrency(c.amount, c.currency)}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{c.nextRenewal}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditTarget(c)} className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No clients found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} client{filtered.length !== 1 ? "s" : ""}</div>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-3 sm:p-4">
          <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Add New Client</h2>
                <p className="text-xs text-muted-foreground">Enter the client company details below.</p>
              </div>
              <button onClick={() => setAddOpen(false)} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Company name *</label>
                <input
                  value={newClient.company}
                  onChange={e => setNewClient({ ...newClient, company: e.target.value })}
                  placeholder="ABC Company Ltd"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Main contact *</label>
                <input
                  value={newClient.contact}
                  onChange={e => setNewClient({ ...newClient, contact: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Email *</label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={e => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="john@company.mu"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Phone</label>
                <input
                  value={newClient.phone}
                  onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="+230 5XXX XXXX"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Billing address</label>
                <input
                  value={newClient.billingAddress}
                  onChange={e => setNewClient({ ...newClient, billingAddress: e.target.value })}
                  placeholder="Port Louis, Mauritius"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Status</label>
                <select
                  value={newClient.status}
                  onChange={e => setNewClient({ ...newClient, status: e.target.value as Status })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                >
                  {["Active", "Pending", "Due Soon", "On Track", "Overdue", "Cancelled"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90"
              >
                Save Client
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && <EditClientModal client={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3"><Trash2 className="w-5 h-5 text-red-500" /></div>
            <h2 className="font-bold text-lg mb-1">Delete client?</h2>
            <p className="text-sm text-muted-foreground mb-5">This will permanently remove <strong>{deleteTarget.company}</strong> from the database.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget.id)} className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditClientModal({ client, onClose, onSave }: { client: Client; onClose: () => void; onSave: (c: Client) => void }) {
  const [form, setForm] = useState(client);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="mx-auto w-full max-w-5xl rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg">Edit Client</h2>
            <p className="text-xs text-muted-foreground">Update the client company details below.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Company</label>
            <input
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Main Contact</label>
            <input
              value={form.contact}
              onChange={e => setForm({ ...form, contact: e.target.value })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Billing Address</label>
            <input
              value={form.billingAddress}
              onChange={e => setForm({ ...form, billingAddress: e.target.value })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as Status })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            >
              {["Active", "Pending", "Due Soon", "On Track", "Overdue", "Cancelled"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── CLIENT DETAIL ────────────────────────────────────────────────────────────

function ClientDetailPage({ client: initClient, clients, contacts, setClients, onBack, onNav, toast }: {
  client: Client; clients: Client[]; contacts: Contact[]; setClients: (c: Client[]) => void;
  onBack: () => void; onNav: (p: Page) => void; toast: (msg: string, type?: Toast["type"]) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const client = clients.find(c => c.id === initClient.id) || initClient;

  function openEditModal() {
    setEditOpen(true);
  }

  async function handleEdit(updatedClient: Client) {
    try {
      const response = await fetch(`/api/clients/${updatedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          company: updatedClient.company,
          companyName: updatedClient.company,
          contact: updatedClient.contact,
          email: updatedClient.email,
          phone: updatedClient.phone,
          status: updatedClient.status,
          billingAddress: updatedClient.billingAddress,
          address: updatedClient.billingAddress,
        }),
      });

      const data = await readApiJson(response, `/api/clients/${updatedClient.id}`);
      if (!response.ok) throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to update client."));

      const savedClient = normalizeClient({ ...updatedClient, ...asRecord(itemFromApi(data, "client")), contact: updatedClient.contact });
      setClients(clients.map(c => c.id === savedClient.id ? savedClient : c));
      setEditOpen(false);
      toast("Client updated in the database.");
    } catch (error) {
      console.error("Update client detail error:", error);
      toast(error instanceof Error ? error.message : "Failed to update client.", "error");
    }
  }

  async function handleDelete() {
    try {
      const response = await fetch(`/api/clients/${client.id}`, { method: "DELETE", headers: { Accept: "application/json" } });
      const data = await readApiJson(response, `/api/clients/${client.id}`);
      if (!response.ok) throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to delete client."));

      setClients(clients.filter(c => c.id !== client.id));
      setDeleted(true);
      setDeleteOpen(false);
      toast("Client deleted from the database.", "info");
    } catch (error) {
      console.error("Delete client detail error:", error);
      toast(error instanceof Error ? error.message : "Failed to delete client.", "error");
    }
  }

  if (deleted) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-muted-foreground">Client has been deleted.</p>
      <button onClick={onBack} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
        Back to Clients
      </button>
    </div>
  );

  const linkedContacts = contacts.filter(c => c.company === client.company);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton onClick={onBack} label="Back to Clients" />
        <div className="h-4 w-px bg-border" />
        <h1 className="text-2xl font-bold">{client.company}</h1>
        <StatusBadge status={client.status} />

        <div className="ml-auto flex gap-2">
          <button
            onClick={openEditModal}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>

          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 px-3 py-2 border border-red-400/50 text-red-500 rounded-md text-sm hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Client Information</h2>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: "Company", value: client.company },
                { label: "Main Contact", value: client.contact },
                { label: "Email", value: client.email },
                { label: "Phone", value: client.phone },
                { label: "Member Since", value: client.joinDate },
                { label: "Active Contracts", value: client.contracts },
              ].map(item => (
                <div key={item.label}>
                  <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                    {item.label}
                  </dt>
                  <dd className="font-medium">{item.value}</dd>
                </div>
              ))}

              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">
                  Billing Address
                </dt>
                <dd className="font-medium">{client.billingAddress}</dd>
              </div>
            </dl>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Active Contracts</h2>
              <button
                onClick={() => onNav("contracts")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {client.contracts} contract{client.contracts !== 1 ? "s" : ""} associated with this client.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Next Renewal</p>
              <p className="font-bold text-lg font-mono">{client.nextRenewal}</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Total Outstanding</p>
              <p className="font-bold font-mono">{fmtCurrency(client.totalOutstanding, "MUR")}</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Overdue Amount</p>
              <p className={cn("font-bold font-mono", client.overdueAmount > 0 ? "text-red-500" : "text-muted-foreground")}>
                {client.overdueAmount > 0 ? fmtCurrency(client.overdueAmount, "MUR") : "None"}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-3">Primary Contacts</h2>

            {linkedContacts.map(c => (
              <div key={c.id} className="mb-3">
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.role}</p>

                <div className="flex gap-2 mt-1">
                  <a
                    href={`mailto:${c.email}`}
                    className="p-1.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                  </a>

                  <a
                    href={`tel:${c.phone}`}
                    className="p-1.5 rounded bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Phone className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}

            {linkedContacts.length === 0 && (
              <p className="text-sm text-muted-foreground">No contacts linked to this client yet.</p>
            )}
          </div>
        </div>
      </div>

      {editOpen && (
        <EditClientModal
          client={client}
          onClose={() => setEditOpen(false)}
          onSave={handleEdit}
        />
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>

            <h2 className="font-bold text-lg mb-1">Delete client?</h2>

            <p className="text-sm text-muted-foreground mb-5">
              This will permanently remove <strong>{client.company}</strong> from the database.
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setDeleteOpen(false)}
                className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent"
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:opacity-90"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── CONTACTS PAGE ────────────────────────────────────────────────────────────

const BLANK_CONTACT: Omit<Contact, "id"> = {
  name: "", company: "", role: "", email: "", phone: "", status: "Active", lastContact: "", notes: ""
};
function normalizeContactFromApi(
  rawValue: unknown,
  fallback?: Partial<Contact>,
): Contact {
  const raw = rawValue as Partial<Contact>;

  return {
    id: String(raw.id ?? fallback?.id ?? ""),
    name: String(raw.name ?? fallback?.name ?? ""),
    company: String(raw.company ?? fallback?.company ?? ""),
    role: String(raw.role ?? fallback?.role ?? ""),
    email: String(raw.email ?? fallback?.email ?? ""),
    phone: String(raw.phone ?? fallback?.phone ?? ""),
    status: (raw.status ?? fallback?.status ?? "Active") as Status,
    lastContact: String(
      raw.lastContact ??
        fallback?.lastContact ??
        new Date().toISOString().split("T")[0],
    ),
    notes: String(raw.notes ?? fallback?.notes ?? ""),
  };
}
function ContactsPage({
  contacts, setContacts, onDetail, clients, contracts, setContracts, toast
}: {
  contacts: Contact[];
  setContacts: (c: Contact[]) => void;
  onDetail: (c: Contact) => void;
  clients: Client[];
  contracts: Contract[];
  setContracts: (c: Contract[]) => void;
  toast: (msg: string, type?: Toast["type"]) => void;
}) {
  const [filter, setFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addContractOpen, setAddContractOpen] = useState(false);
  const [contactForm, setContactForm] = useState<Omit<Contact, "id">>(BLANK_CONTACT);

  const filterText = filter.toLowerCase();

  const filtered = contacts.filter((c) =>
    String(c.name ?? "").toLowerCase().includes(filterText) ||
    String(c.company ?? "").toLowerCase().includes(filterText) ||
    String(c.email ?? "").toLowerCase().includes(filterText)
  );

  function clientIdForCompany(company: string) {
    return clients.find((client) => client.company === company)?.id ?? "";
  }

  async function saveContact() {
    if (!contactForm.name.trim() || !contactForm.company.trim() || !contactForm.email.trim()) {
      toast("Name, company and email are required.", "error");
      return;
    }

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...contactForm,
          clientId: clientIdForCompany(contactForm.company),
          lastContact: contactForm.lastContact || new Date().toISOString().split("T")[0],
        }),
      });

      const data = await readApiJson(response, "/api/contacts");

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to create contact."));
      }

      const savedContact = normalizeContact({ ...contactForm, ...asRecord(itemFromApi(data, "contact")) });

      setContacts([savedContact, ...contacts]);
      setAddContactOpen(false);
      setContactForm(BLANK_CONTACT);

      toast("Contact added to the database.");
    } catch (error) {
      console.error("Create contact frontend error:", error);
      toast(error instanceof Error ? error.message : "Failed to create contact.", "error");
    }
  }

  async function handleEditContact(updatedContact: Contact) {
    if (!updatedContact.id) {
      toast("Contact ID is missing.", "error");
      return;
    }

    try {
      const response = await fetch(`/api/contacts/${updatedContact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...updatedContact,
          clientId: clientIdForCompany(updatedContact.company),
        }),
      });

      const data = await readApiJson(response, `/api/contacts/${updatedContact.id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to update contact."));
      }

      const savedContact = normalizeContact({ ...updatedContact, ...asRecord(itemFromApi(data, "contact")) });

      setContacts(contacts.map((contact) =>
        contact.id === updatedContact.id ? savedContact : contact,
      ));

      setEditTarget(null);
      toast("Contact updated in the database.");
    } catch (error) {
      console.error("Update contact error:", error);
      toast(error instanceof Error ? error.message : "Failed to update contact.", "error");
    }
  }

  async function handleDeleteContact(id: string) {
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readApiJson(response, `/api/contacts/${id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to delete contact."));
      }

      setContacts(contacts.filter((contact) => contact.id !== id));
      setDeleteTarget(null);

      toast("Contact deleted from the database.", "info");
    } catch (error) {
      console.error("Delete contact error:", error);
      toast(error instanceof Error ? error.message : "Failed to delete contact.", "error");
    }
  }

  async function saveContractFromContacts(contractToSave: Contract) {
  try {
    const response = await fetch("/api/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...contractToSave,
        contractName: contractToSave.name,
        name: contractToSave.name,
        type: contractToSave.contractType,
        value: contractToSave.amount,
      }),
    });

    const data = await readApiJson(response, "/api/contracts");

    if (!response.ok) {
      throw new Error(
        stringValue(
          asRecord(data).message ?? asRecord(data).error,
          "Failed to create contract.",
        ),
      );
    }

    const savedContract = normalizeContract({
      ...contractToSave,
      ...asRecord(itemFromApi(data, "contract")),
    });

    setContracts([savedContract, ...contracts]);
    setAddContractOpen(false);

    toast("Contract added to the database.");
  } catch (error) {
    console.error("Create contract from contacts error:", error);

    toast(
      error instanceof Error ? error.message : "Failed to create contract.",
      "error",
    );
  }
}
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-1">All contact persons across your Mauritius client base</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddContactOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter contacts…"
          className="w-full pl-9 pr-4 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border bg-muted/40">
                {["Name", "Company", "Role", "Email", "Phone", "Status", "Last Contact", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} onClick={() => onDetail(c)} className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-bold shrink-0">
                        {String(c.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.company}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.role || "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.email}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={c.status} /></td>
                  <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">{c.lastContact || "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setEditTarget(c)}
                        className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No contacts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} contacts</div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3"><Trash2 className="w-5 h-5 text-red-500" /></div>
            <h2 className="font-bold text-lg mb-1">Delete contact?</h2>
            <p className="text-sm text-muted-foreground mb-5">Remove <strong>{deleteTarget.name}</strong> from the database?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
              <button onClick={() => handleDeleteContact(deleteTarget.id)} className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <EditContactModal
          contact={editTarget}
          clients={clients}
          onClose={() => setEditTarget(null)}
          onSave={handleEditContact}
        />
      )}

      {addContactOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-6 w-full max-w-3xl shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Add Contact</h2>
              <button onClick={() => { setAddContactOpen(false); setContactForm(BLANK_CONTACT); }} className="p-1.5 rounded hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1">Full Name *</label>
                <input value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} placeholder="Jean-Pierre Labelle" className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Company *</label>
                <select value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))} className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                  <option value="">Select client company</option>
                  {clients.map(client => <option key={client.id} value={client.company}>{client.company}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Role / Position</label>
                <input value={contactForm.role} onChange={e => setContactForm(p => ({ ...p, role: e.target.value }))} placeholder="Finance Manager" className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Email Address *</label>
                <input value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))} placeholder="jp.labelle@company.mu" className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Phone (+230)</label>
                <input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))} placeholder="+230 5XXX XXXX" className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Status</label>
                <select value={contactForm.status} onChange={e => setContactForm(p => ({ ...p, status: e.target.value as Status }))}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                  {["Active", "Pending", "On Hold"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium block mb-1">Notes</label>
                <textarea value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} placeholder="Any relevant notes about this contact…"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring resize-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-5 md:col-span-2">
              <button onClick={() => { setAddContactOpen(false); setContactForm(BLANK_CONTACT); }} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
              <button onClick={saveContact} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Add Contact</button>
            </div>
          </div>
        </div>
      )}

      {addContractOpen && (
        <AddContractWizard
          clients={clients}
          contacts={contacts}
          onSave={saveContractFromContacts}
          onClose={() => setAddContractOpen(false)}
        />
      )}
    </div>
  );
}

function EditContactModal({ contact, clients, onClose, onSave }: { contact: Contact; clients: Client[]; onClose: () => void; onSave: (c: Contact) => void }) {
  const [form, setForm] = useState(contact);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">Edit Contact</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Full Name</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Company</label>
            <select value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
              <option value="">Select client company</option>
              {clients.map(client => <option key={client.id} value={client.company}>{client.company}</option>)}
            </select>
          </div>
          {[{ label: "Role", key: "role" }, { label: "Email", key: "email" }, { label: "Phone", key: "phone" }, { label: "Last Contact", key: "lastContact" }].map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium block mb-1">{f.label}</label>
              <input value={String((form as unknown as Record<string, string>)[f.key] ?? "")} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
            </div>
          ))}
          <div>
            <label className="text-sm font-medium block mb-1">Status</label>
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
              {["Active", "Pending", "On Hold", "Cancelled"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Save</button>
        </div>
      </div>
    </div>
  );
}


// ─── CONTACT DETAIL ───────────────────────────────────────────────────────────

function ContactDetailPage({ contact: init, contacts, setContacts, clients, onBack, toast }: { contact: Contact; contacts: Contact[]; setContacts: (c: Contact[]) => void; clients: Client[]; onBack: () => void; toast: (msg: string, type?: Toast["type"]) => void }) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [form, setForm] = useState(init);
  const contact = contacts.find((item) => item.id === init.id) || init;

  function clientIdForCompany(company: string) {
    return clients.find((client) => client.company === company)?.id ?? "";
  }

  async function saveEditWith(contactToSave: Contact = form) {
    try {
      const response = await fetch(`/api/contacts/${contactToSave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...contactToSave,
          clientId: clientIdForCompany(contactToSave.company),
        }),
      });

      const data = await readApiJson(response, `/api/contacts/${contactToSave.id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to update contact."));
      }

      const savedContact = normalizeContact({ ...contactToSave, ...asRecord(itemFromApi(data, "contact")) });
      setContacts(contacts.map(c => c.id === savedContact.id ? savedContact : c));
      setForm(savedContact);
      setEditOpen(false);
      toast("Contact updated in the database.");
    } catch (error) {
      console.error("Update contact detail error:", error);
      toast(error instanceof Error ? error.message : "Failed to update contact.", "error");
    }
  }

  async function deleteContact() {
    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      const data = await readApiJson(response, `/api/contacts/${contact.id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to delete contact."));
      }

      setContacts(contacts.filter(c => c.id !== contact.id));
      setDeleted(true);
      setDeleteOpen(false);
      toast("Contact deleted from the database.", "info");
    } catch (error) {
      console.error("Delete contact detail error:", error);
      toast(error instanceof Error ? error.message : "Failed to delete contact.", "error");
    }
  }

  if (deleted) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <p className="text-muted-foreground">Contact has been deleted.</p>
      <button onClick={onBack} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Back to Contacts</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton onClick={onBack} label="Back to Contacts" />
        <div className="h-4 w-px bg-border" />
        <div><h1 className="text-2xl font-bold">{contact.name}</h1><p className="text-muted-foreground text-sm">{contact.role || "Contact"} — {contact.company}</p></div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setForm(contact); setEditOpen(true); }} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent transition-colors">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-2 px-3 py-2 border border-red-400/50 text-red-500 rounded-md text-sm hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Contact Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[{ label: "Full Name", value: contact.name }, { label: "Company", value: contact.company }, { label: "Role", value: contact.role || "—" }, { label: "Last Contact", value: contact.lastContact || "—" }].map(item => (
                <div key={item.label}><dt className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">{item.label}</dt><dd className="font-medium">{item.value}</dd></div>
              ))}
              <div className="col-span-2"><dt className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Notes</dt><dd className="text-muted-foreground">{contact.notes || "—"}</dd></div>
            </dl>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Reach Out</h2>
            <div className="flex gap-3">
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-md text-sm font-medium hover:opacity-90">
                <Mail className="w-4 h-4" /> Send Email
              </a>
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-md text-sm font-medium hover:bg-accent">
                <Phone className="w-4 h-4" /> Call
              </a>
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{contact.email}</p>
              <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{contact.phone || "—"}</p>
            </div>
          </div>
        </div>
        <div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <StatusBadge status={contact.status} />
            {[{ label: "Email", value: contact.email }, { label: "Phone", value: contact.phone || "—" }, { label: "Last Contact", value: contact.lastContact || "—" }].map(item => (
              <div key={item.label} className="border-t border-border pt-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">{item.label}</p>
                <p className="text-sm font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editOpen && (
        <EditContactModal contact={form} clients={clients} onClose={() => setEditOpen(false)} onSave={(updated) => { setForm(updated); void saveEditWith(updated); }} />
      )}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3"><Trash2 className="w-5 h-5 text-red-500" /></div>
            <h2 className="font-bold text-lg mb-1">Delete contact?</h2>
            <p className="text-sm text-muted-foreground mb-5">This will permanently remove <strong>{contact.name}</strong> from the database.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteOpen(false)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
              <button onClick={deleteContact} className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADD CONTRACT WIZARD ──────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { days: 90, label: "90 days before" },
  { days: 60, label: "60 days before" },
  { days: 30, label: "30 days before" },
  { days: 14, label: "14 days before" },
  { days: 7, label: "7 days before" },
  { days: 0, label: "On renewal date" },
];

interface WizardForm {
  clientId: string; client: string; name: string; reference: string;
  serviceDescription: string; startDate: string; amount: string; currency: string;
  assignedTo: string; contractType: string;
  renewalDate: string; renewalFrequency: "Monthly" | "Quarterly" | "Yearly" | "Custom";
  noticePeriod: string; autoRenew: boolean;
  reminderDays: number[]; recipientTypes: string[];
}

function AddContractWizard({ clients, contacts = [], onSave, onClose }: { clients: Client[]; contacts?: Contact[]; onSave: (c: Contract) => void; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>({
    clientId: "", client: "", name: "", reference: "", serviceDescription: "",
    startDate: "", amount: "", currency: "MUR", assignedTo: STAFF_MEMBERS[0], contractType: "Service",
    renewalDate: "", renewalFrequency: "Yearly", noticePeriod: "30 days", autoRenew: false,
    reminderDays: [90, 60, 30, 14, 7], recipientTypes: ["primary", "staff"],
  });

  const steps = ["Contract Details", "Renewal", "Notifications", "Review"];

  function toggleReminder(days: number) {
    setForm(f => ({ ...f, reminderDays: f.reminderDays.includes(days) ? f.reminderDays.filter(d => d !== days) : [...f.reminderDays, days] }));
  }
  function toggleRecipient(type: string) {
    setForm(f => ({ ...f, recipientTypes: f.recipientTypes.includes(type) ? f.recipientTypes.filter(t => t !== type) : [...f.recipientTypes, type] }));
  }

  function handleSave() {
    const reminders: ContractReminder[] = REMINDER_OPTIONS
      .filter(o => form.reminderDays.includes(o.days))
      .map(o => ({ days: o.days, sent: false }));
    const daysLeft = form.renewalDate ? calcDaysLeft(form.renewalDate) : 365;
    const status: Status = daysLeft < 0 ? "Overdue" : daysLeft <= 30 ? "Due Soon" : "Active";
    const newContract: Contract = {
      id: `con${Date.now()}`, name: form.name, clientId: form.clientId, client: form.client,
      reference: form.reference, serviceDescription: form.serviceDescription,
      startDate: form.startDate, renewalDate: form.renewalDate,
      amount: parseFloat(form.amount) || 0, currency: form.currency,
      assignedTo: form.assignedTo, status, contractType: form.contractType,
      daysLeft, autoRenew: form.autoRenew, renewalFrequency: form.renewalFrequency,
      noticePeriod: form.noticePeriod, reminders, recipientTypes: form.recipientTypes, notes: [],
    };
    onSave(newContract);
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <h2 className="font-bold text-lg">Add Contract</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-6 py-4 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={cn("w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0",
                step > i + 1 ? "bg-foreground text-background" : step === i + 1 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>
                {step > i + 1 ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={cn("text-xs font-medium hidden sm:block", step === i + 1 ? "text-foreground" : "text-muted-foreground")}>{s}</span>
              {i < steps.length - 1 && <div className={cn("h-px flex-1 ml-2", step > i + 1 ? "bg-foreground" : "bg-border")} />}
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Client *</label>
                <select value={form.clientId} onChange={e => { const c = clients.find(c => c.id === e.target.value); setForm(f => ({ ...f, clientId: e.target.value, client: c?.company || "" })); }}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Contract name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Annual Maintenance Contract"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Contract reference</label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. NX-2025-001"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Service description</label>
                <textarea value={form.serviceDescription} onChange={e => setForm(f => ({ ...f, serviceDescription: e.target.value }))} placeholder="Describe the services covered…" rows={3}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Start date</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Contract amount</label>
                  <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0"
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Contract type</label>
                  <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value }))}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                    {CONTRACT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium block mb-1">Renewal date *</label>
                <input type="date" value={form.renewalDate} onChange={e => setForm(f => ({ ...f, renewalDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Renewal frequency</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Monthly", "Quarterly", "Yearly", "Custom"] as const).map(freq => (
                    <button key={freq} onClick={() => setForm(f => ({ ...f, renewalFrequency: freq }))}
                      className={cn("py-2 border rounded-md text-sm font-medium transition-colors", form.renewalFrequency === freq ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}>
                      {freq}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Notice period</label>
                <input value={form.noticePeriod} onChange={e => setForm(f => ({ ...f, noticePeriod: e.target.value }))} placeholder="e.g. 30 days"
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Auto-renew</label>
                <div className="flex gap-3">
                  {[{ label: "Yes", value: true }, { label: "No", value: false }].map(opt => (
                    <button key={opt.label} onClick={() => setForm(f => ({ ...f, autoRenew: opt.value }))}
                      className={cn("flex-1 py-2 border rounded-md text-sm font-medium transition-colors", form.autoRenew === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent")}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <p className="text-sm font-medium mb-3">Reminder schedule</p>
                <div className="space-y-2">
                  {REMINDER_OPTIONS.map(opt => (
                    <label key={opt.days} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <input type="checkbox" checked={form.reminderDays.includes(opt.days)} onChange={() => toggleReminder(opt.days)}
                        className="w-4 h-4 rounded border-border accent-foreground" />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium mb-3">Recipient</p>
                <div className="space-y-2">
                  {[{ key: "primary", label: "Primary client contact" }, { key: "secondary", label: "Secondary contact" }, { key: "staff", label: "Assigned staff member" }].map(r => (
                    <label key={r.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <input type="checkbox" checked={form.recipientTypes.includes(r.key)} onChange={() => toggleRecipient(r.key)}
                        className="w-4 h-4 rounded border-border accent-foreground" />
                      <span className="text-sm">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-3 text-sm md:col-span-2">
              <h3 className="font-semibold">Review</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2">
                <span className="text-muted-foreground">Client</span><span className="font-medium text-right">{form.client || "—"}</span>
                <span className="text-muted-foreground">Contract</span><span className="font-medium text-right">{form.name || "—"}</span>
                <span className="text-muted-foreground">Renewal date</span><span className="font-medium text-right font-mono text-xs">{form.renewalDate || "—"}</span>
                <span className="text-muted-foreground">Amount</span><span className="font-medium text-right font-mono text-xs">{fmtCurrency(parseFloat(form.amount) || 0, form.currency)}</span>
                <span className="text-muted-foreground">Reminders</span><span className="font-medium text-right text-xs">{form.reminderDays.map(d => d === 0 ? "On date" : `${d}d`).join(", ") || "None"}</span>
                <span className="text-muted-foreground">Auto-renew</span><span className="font-medium text-right">{form.autoRenew ? "Yes" : "No"}</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-2 border-t border-border pt-4">
          {step > 1 && <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 border border-border rounded-md text-sm hover:bg-accent">Back</button>}
          {step < 4 && (
            <button onClick={() => setStep(s => s + 1)} className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Next</button>
          )}
          {step === 4 && (
            <button onClick={handleSave} className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Activate Contract</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RENEWAL CALENDAR ─────────────────────────────────────────────────────────

function RenewalCalendar({ contracts }: { contracts: Contract[] }) {
  const [curDate, setCurDate] = useState(() => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
});
  const year = curDate.getFullYear();
  const month = curDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = curDate.toLocaleDateString("en-MU", { month: "long", year: "numeric" });

  const renewalsByDay: Record<number, Contract[]> = {};
  contracts.forEach(c => {
    if (!c.renewalDate) return;
    const d = new Date(c.renewalDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!renewalsByDay[day]) renewalsByDay[day] = [];
      renewalsByDay[day].push(c);
    }
  });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{monthName}</h2>
        <div className="flex gap-1">
          <button onClick={() => setCurDate(new Date(year, month - 1, 1))} className="p-1.5 rounded hover:bg-accent transition-colors"><ChevronRight className="w-4 h-4 rotate-180" /></button>
          <button onClick={() => setCurDate(new Date(year, month + 1, 1))} className="p-1.5 rounded hover:bg-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <div key={i} className={cn(
            "min-h-[52px] rounded-lg p-1 text-xs",
            day ? "border border-border hover:bg-muted/30 transition-colors" : "",
            day && renewalsByDay[day as number] ? "bg-foreground/5 border-foreground/20" : ""
          )}>
            {day && (
              <>
                <span className={cn("font-medium block text-center", renewalsByDay[day] ? "text-foreground" : "text-muted-foreground")}>{day}</span>
                {renewalsByDay[day]?.map(c => (
                  <div key={c.id} className={cn("mt-0.5 px-1 py-0.5 rounded text-[9px] font-medium truncate", statusColor(c.status))}>
                    {c.client.split(" ")[0]}
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
      {Object.keys(renewalsByDay).length === 0 && (
        <p className="text-center text-xs text-muted-foreground mt-4">No renewals this month</p>
      )}
    </div>
  );
}

// ─── CONTRACTS PAGE ──────────────────────────────────────────────────────────

function ContractsPage({ contracts, clients, contacts, setContracts, onDetail, toast }: {
  contracts: Contract[]; clients: Client[]; contacts: Contact[]; setContracts: (c: Contract[]) => void;
  onDetail: (c: Contract) => void; toast: (msg: string, type?: Toast["type"]) => void;
}) {
  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All Statuses");
  const [filterClient, setFilterClient] = useState("All Clients");
  const [filterType, setFilterType] = useState("All Contract Types");
  //const [filterStaff, setFilterStaff] = useState("All Assigned Staff");

  const totalContracts = contracts.length;
  const activeContracts = contracts.filter(c => c.status === "Active" || c.status === "On Track" || c.status === "Renewed").length;
  const expiring30 = contracts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 30 && c.status !== "Cancelled").length;
  const overdue = contracts.filter(c => c.daysLeft < 0 && c.status !== "Cancelled" && c.status !== "Renewed").length;
  const onHold = contracts.filter(c => c.status === "On Hold").length;

  const searchText = search.toLowerCase();

  const filtered = contracts.filter(c => {
    if (
      search &&
      !String(c.name ?? "").toLowerCase().includes(searchText) &&
      !String(c.client ?? "").toLowerCase().includes(searchText) &&
      !String(c.reference ?? "").toLowerCase().includes(searchText)
    ) return false;
    if (filterStatus !== "All Statuses" && c.status !== filterStatus) return false;
    if (filterClient !== "All Clients" && c.client !== filterClient) return false;
    if (filterType !== "All Contract Types" && c.contractType !== filterType) return false;
    //if (filterStaff !== "All Assigned Staff" && c.assignedTo !== filterStaff) return false;
    return true;
  });

async function handleAdd(c: Contract) {
  const contractName = String(c.name ?? "").trim();

  if (!contractName) {
    toast("Contract name is missing before sending to the database.", "error");
    return;
  }

  try {
    const payload = {
      ...c,
      name: contractName,
      contractName,
      contractType: c.contractType || "Service",
      type: c.contractType || "Service",
      amount: c.amount || 0,
      value: c.amount || 0,
      clientId: c.clientId,
      client: c.client,
    };

    console.log("CREATE CONTRACT PAYLOAD:", payload);

    const response = await fetch("/api/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await readApiJson(response, "/api/contracts");

    if (!response.ok) {
      throw new Error(
        stringValue(
          asRecord(data).message ?? asRecord(data).error,
          "Failed to create contract.",
        ),
      );
    }

    const savedContract = normalizeContract({
      ...c,
      ...asRecord(itemFromApi(data, "contract")),
      name: contractName,
      contractName,
    });

    setContracts([savedContract, ...contracts]);
    setAddOpen(false);

    toast("Contract created successfully.");
  } catch (error) {
    console.error("Create contract frontend error:", error);

    toast(
      error instanceof Error ? error.message : "Failed to create contract.",
      "error",
    );
  }
}

  async function handleDelete(id: string) {
    try {
      const response = await fetch(`/api/contracts/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      const data = await readApiJson(response, `/api/contracts/${id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to delete contract."));
      }

      setContracts(contracts.filter(c => c.id !== id));
      toast("Contract deleted from the database.", "info");
    } catch (error) {
      console.error("Delete contract error:", error);
      toast(error instanceof Error ? error.message : "Failed to delete contract.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage all client contracts</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-all">
          <Plus className="w-4 h-4" /> Add Contract
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {[
          { label: "Total Contracts", value: totalContracts },
          { label: "Active Contracts", value: activeContracts },
          { label: "Expiring in 30 Days", value: expiring30, warn: expiring30 > 0 },
          { label: "Overdue Contracts", value: overdue, crit: overdue > 0 },
          { label: "On Hold", value: onHold },
        ].map(s => (
          <div key={s.label} className={cn("bg-card border rounded-xl p-4", s.crit ? "border-red-400/50" : (s as { warn?: boolean }).warn ? "border-amber-400/50" : "border-border")}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex border-b border-border">
        {[{ key: "list", label: "Contracts Lists", icon: FileText }, { key: "calendar", label: "Renewal Calendar", icon: CalendarDays }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as "list" | "calendar")}
            className={cn("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "calendar" && <RenewalCalendar contracts={contracts} />}

      {tab === "list" && (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts…"
                className="w-full pl-8 pr-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
            </div>
            {[
              { value: filterStatus, set: setFilterStatus, options: ["All Statuses", "Active", "Due Soon", "Overdue", "On Hold", "Cancelled", "Renewed"] },
              { value: filterClient, set: setFilterClient, options: ["All Clients", ...clients.map(c => c.company)] },
              { value: filterType, set: setFilterType, options: ["All Contract Types", ...CONTRACT_TYPES] },
              //{ value: filterStaff, set: setFilterStaff, options: ["All Assigned Staff", ...STAFF_MEMBERS] },
            ].map((f, i) => (
              <select key={i} value={f.value} onChange={e => f.set(e.target.value)}
                className="px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                   {["Contract", "Client", "Type", "Start Date", "Renewal Date", "Status", "Days Left", "Actions"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-xs leading-tight">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{c.reference}</p>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{c.client}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{c.contractType}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{c.startDate}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{c.renewalDate}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3.5">
                        <span className={cn("font-mono text-xs font-semibold", c.daysLeft < 0 ? "text-red-500" : c.daysLeft <= 30 ? "text-amber-600" : "text-muted-foreground")}>
                          {c.daysLeft < 0 ? `${Math.abs(c.daysLeft)}d overdue` : `${c.daysLeft}d`}
                        </span>
                      </td>
                      
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1">
                          <button onClick={() => onDetail(c)} className="px-2.5 py-1 border border-border rounded text-xs hover:bg-accent transition-colors font-medium whitespace-nowrap">
                            View Renewal
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No contracts match your filters</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
              Showing {filtered.length} of {contracts.length} contracts
            </div>
          </div>
        </>
      )}

      {addOpen && <AddContractWizard clients={clients} contacts={contacts} onSave={handleAdd} onClose={() => setAddOpen(false)} />}
    </div>
  );
}

// ─── CONTRACT DETAIL ──────────────────────────────────────────────────────────

function ContractDetailPage({ contract: initContract, contracts, contacts, setContracts, onBack, toast }: {
  contract: Contract; contracts: Contract[]; contacts: Contact[]; setContracts: (c: Contract[]) => void;
  onBack: () => void; toast: (msg: string, type?: Toast["type"]) => void;
}) {
  const contract = contracts.find(c => c.id === initContract.id) || initContract;
  const [noteInput, setNoteInput] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(contract);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function persistContract(updated: Contract, message: string) {
    try {
      const response = await fetch(`/api/contracts/${updated.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(updated),
      });

      const data = await readApiJson(response, `/api/contracts/${updated.id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to update contract."));
      }

      const savedContract = normalizeContract({
        ...updated,
        ...asRecord(itemFromApi(data, "contract")),
      });

      setContracts(contracts.map(c => c.id === savedContract.id ? savedContract : c));
      toast(message);
      return savedContract;
    } catch (error) {
      console.error("Update contract error:", error);
      toast(error instanceof Error ? error.message : "Failed to update contract.", "error");
      return null;
    }
  }

  function markRenewed() {
    void persistContract({ ...contract, status: "Renewed" as Status }, "Contract marked as renewed in the database.");
  }

  function markOverdue() {
    void persistContract({ ...contract, status: "Overdue" as Status }, "Contract marked as overdue in the database.");
  }

  function markCancelled() {
    void persistContract({ ...contract, status: "Cancelled" as Status }, "Contract marked as cancelled in the database.");
  }

  async function addNote() {
    if (!noteInput.trim()) return;
    const now = new Date();
    const timestamp = now.toLocaleDateString("en-MU", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + now.toLocaleTimeString("en-MU", { hour: "2-digit", minute: "2-digit" });
    const newNote = `${noteInput.trim()} — Staff Member | ${timestamp}`;
    const updated = {
      ...contract,
      notes: [...(Array.isArray(contract.notes) ? contract.notes : []), newNote],
    };

    const saved = await persistContract(updated, "Note added to the database.");
    if (saved) setNoteInput("");
  }

  async function saveEdit() {
    const updated = {
      ...editForm,
      daysLeft: editForm.renewalDate ? calcDaysLeft(editForm.renewalDate) : contract.daysLeft,
    };

    const saved = await persistContract(updated, "Contract updated in the database.");
    if (saved) setEditOpen(false);
  }

  async function deleteContract() {
    try {
      const response = await fetch(`/api/contracts/${contract.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readApiJson(response, `/api/contracts/${contract.id}`);

      if (!response.ok) {
        throw new Error(stringValue(asRecord(data).message ?? asRecord(data).error, "Failed to delete contract."));
      }

      setContracts(contracts.filter(c => c.id !== contract.id));
      setDeleteOpen(false);
      onBack();
      toast("Contract deleted from the database.", "info");
    } catch (error) {
      console.error("Delete contract error:", error);
      toast(error instanceof Error ? error.message : "Failed to delete contract.", "error");
    }
  }

  const clientContact = contacts.find(c => c.company === contract.client);
  const contractNotes = Array.isArray(contract.notes) ? contract.notes : [];
  const contractReminders = Array.isArray(contract.reminders) ? [...contract.reminders] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <BackButton onClick={onBack} label="Back to Contracts" />
        <div className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-xl font-bold">{contract.name}</h1>
          <p className="text-muted-foreground text-sm">{contract.client} · {contract.reference}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mr-1">Actions</span>
          <button onClick={markRenewed} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:opacity-90 transition-all">
            <Check className="w-3 h-3" /> Mark as Renewed
          </button>
          <button onClick={markOverdue} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold hover:opacity-90 transition-all">
            <AlertTriangle className="w-3 h-3" /> Mark as Overdue
          </button>
          <button onClick={markCancelled} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-500 text-white rounded-md text-xs font-semibold hover:opacity-90 transition-all">
            <Ban className="w-3 h-3" /> Mark as Cancelled
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { setEditForm(contract); setEditOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-xs font-semibold hover:bg-accent transition-colors">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
            <button onClick={() => setDeleteOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-500 rounded-md text-xs font-semibold hover:bg-red-50 transition-colors">
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-5 text-sm">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Client</p>
            <p className="font-semibold">{contract.client}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Reference</p>
            <p className="font-semibold font-mono text-xs">{contract.reference}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contract Type</p>
            <p className="font-semibold">{contract.contractType}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Status</p>
            <StatusBadge status={contract.status} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Start Date</p>
            <p className="font-semibold font-mono text-xs">{contract.startDate}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Renewal Date</p>
            <p className="font-semibold font-mono text-xs">{contract.renewalDate}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Days Left</p>
            <p className={cn("font-semibold font-mono", contract.daysLeft < 0 ? "text-red-500" : contract.daysLeft <= 30 ? "text-amber-600" : "text-foreground")}>
              {contract.daysLeft < 0 ? `${Math.abs(contract.daysLeft)}d overdue` : `${contract.daysLeft} days`}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Auto-Renew</p>
            <p className="font-semibold">{contract.autoRenew ? "Yes" : "No"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Amount</p>
            <p className="font-semibold font-mono">{fmtCurrency(contract.amount, contract.currency)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Renewal Frequency</p>
            <p className="font-semibold">{contract.renewalFrequency}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notice Period</p>
            <p className="font-semibold">{contract.noticePeriod}</p>
          </div>
        
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Primary Contact</p>
            <p className="font-semibold">{clientContact?.name || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact Email</p>
            <p className="font-semibold text-xs break-all">{clientContact?.email || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Contact Phone</p>
            <p className="font-semibold text-xs">{clientContact?.phone || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recipients</p>
            <p className="font-semibold text-xs">{contract.recipientTypes?.join(", ") || "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-5">Renewal Timeline</h2>
          <div className="relative">
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-5">
              {contractReminders.sort((a, b) => b.days - a.days).map((r, i) => {
                const label = r.days === 0 ? "Renewal Date" : `${r.days} days before`;
                return (
                  <div key={`${r.days}-${i}`} className="flex items-center gap-4 relative">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 border-2",
                      r.sent ? "bg-foreground border-foreground" : "bg-background border-border")}>
                      {r.sent ? <Check className="w-3 h-3 text-background" /> : <Clock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{label}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                        r.sent ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                        {r.sent ? "Email delivered" : "Scheduled"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {contractReminders.length === 0 && <p className="text-sm text-muted-foreground">No reminders set.</p>}
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Internal Notes</h2>
          <div className="flex-1 space-y-3 mb-4 max-h-48 overflow-y-auto">
            {contractNotes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            {contractNotes.map((note, i) => {
              const [text, meta] = note.split(" — ");
              return (
                <div key={i} className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="text-foreground leading-relaxed">· {text}</p>
                  {meta && <p className="text-xs text-muted-foreground mt-1">{meta}</p>}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-auto">
            <input value={noteInput} onChange={e => setNoteInput(e.target.value)} placeholder="Add an internal note…"
              onKeyDown={e => { if (e.key === "Enter") void addNote(); }}
              className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
            <button onClick={() => void addNote()} className="px-3 py-2 bg-foreground text-background rounded-md text-sm font-semibold hover:opacity-90">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Email History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Date", "Template", "Recipient", "Status", "View"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {contractReminders.filter(r => r.sent).map((r, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.scheduledDate || "—"}</td>
                  <td className="px-4 py-2.5">{r.days === 0 ? "Renewal Date" : `${r.days}-Day Reminder`}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{clientContact?.email || "—"}</td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Delivered</span></td>
                  <td className="px-4 py-2.5"><button className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors">View</button></td>
                </tr>
              ))}
              {!contractReminders.some(r => r.sent) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">No emails sent yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {contract.serviceDescription && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-2">Service Description</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{contract.serviceDescription}</p>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md shadow-2xl max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Edit Contract</h2>
              <button onClick={() => setEditOpen(false)} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {[{ label: "Contract Name", key: "name" }, { label: "Reference", key: "reference" }, { label: "Notice Period", key: "noticePeriod" }].map(f => (
                <div key={f.key}>
                  <label className="text-sm font-medium block mb-1">{f.label}</label>
                  <input value={String((editForm as unknown as Record<string, string | number>)[f.key] ?? "")} onChange={e => setEditForm({ ...editForm, [f.key]: e.target.value })}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium block mb-1">Service Description</label>
                <textarea value={editForm.serviceDescription} onChange={e => setEditForm({ ...editForm, serviceDescription: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Renewal Date</label>
                <input type="date" value={editForm.renewalDate} onChange={e => setEditForm({ ...editForm, renewalDate: e.target.value })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Amount</label>
                  <input value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Currency</label>
                  <select value={editForm.currency} onChange={e => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                    {CURRENCIES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Contract Type</label>
                <select value={editForm.contractType} onChange={e => setEditForm({ ...editForm, contractType: e.target.value })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                  {CONTRACT_TYPES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
             
              <div>
                <label className="text-sm font-medium block mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value as Status })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring">
                  {["Active", "Due Soon", "Overdue", "On Hold", "Renewed", "Cancelled"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditOpen(false)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
              <button onClick={() => void saveEdit()} className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-sm shadow-2xl">
            <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mb-3"><Trash2 className="w-5 h-5 text-red-500" /></div>
            <h2 className="font-bold text-lg mb-1">Delete contract?</h2>
            <p className="text-sm text-muted-foreground mb-5">This will permanently remove <strong>{contract.name}</strong> from the database.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteOpen(false)} className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent">Cancel</button>
              <button onClick={() => void deleteContract()} className="flex-1 py-2 bg-red-600 text-white rounded-md text-sm font-semibold hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function SettingsPage({
  subpage,
  onSubpage,
  toast,
  userProfile,
  setUserProfile,
  onSaveUserProfile,
  organizationProfile,
  setOrganizationProfile,
  onSaveOrganizationProfile,
  preferences,
  setPreferences,
  onSavePreferences,
  emailTemplates,
  setEmailTemplates,
  onSaveEmailTemplates,
}: {
  subpage: Page;
  onSubpage: (p: Page) => void;
  toast: (msg: string, type?: Toast["type"]) => void;
  userProfile: UserProfile;
  setUserProfile: (p: UserProfile) => void;
  onSaveUserProfile: (p: UserProfile) => Promise<void>;
  organizationProfile: OrganizationProfile;
  setOrganizationProfile: (p: OrganizationProfile) => void;
  onSaveOrganizationProfile: (p: OrganizationProfile) => Promise<void>;
  preferences: AppPreferences;
  setPreferences: (p: AppPreferences) => void;
  onSavePreferences: (p: AppPreferences) => Promise<void>;
  emailTemplates: EmailTemplateSetting[];
  setEmailTemplates: (p: EmailTemplateSetting[]) => void;
  onSaveEmailTemplates: (p: EmailTemplateSetting[]) => Promise<void>;
}) {
  const MENU = [
    { icon: User, label: "Account", page: "settings-account" as Page },
    { icon: Building, label: "Organization", page: "settings-org" as Page },
    { icon: Lock, label: "Account & Security", page: "settings-security" as Page },
    { icon: Mail, label: "Email & Templates", page: "settings-email" as Page },
    { icon: Sliders, label: "Preferences", page: "settings" as Page },
    { icon: HelpCircle, label: "Get Help", page: "settings-help" as Page },
    { icon: FileText, label: "Terms & Permissions", page: "settings-terms" as Page },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your account, organisation, and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-2">
          {MENU.map(({ icon: Icon, label, page }) => (
            <button
              key={page}
              onClick={() => onSubpage(page)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                subpage === page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="xl:col-span-3 bg-card border border-border rounded-xl p-4 sm:p-6 min-w-0">
          {subpage === "settings" && (
            <SettingsPreferences
              toast={toast}
              preferences={preferences}
              setPreferences={setPreferences}
              onSavePreferences={onSavePreferences}
            />
          )}

          {subpage === "settings-account" && (
            <SettingsAccount
              toast={toast}
              profile={userProfile}
              setProfile={setUserProfile}
              onSaveProfile={onSaveUserProfile}
            />
          )}

          {subpage === "settings-org" && (
            <SettingsOrg
              toast={toast}
              profile={organizationProfile}
              setProfile={setOrganizationProfile}
              onSaveProfile={onSaveOrganizationProfile}
            />
          )}

          {subpage === "settings-security" && <SettingsSecurity toast={toast} />}

          {subpage === "settings-email" && (
            <SettingsEmail
              toast={toast}
              templates={emailTemplates}
              setTemplates={setEmailTemplates}
              onSaveTemplates={onSaveEmailTemplates}
            />
          )}

          {subpage === "settings-help" && <SettingsHelp />}
          {subpage === "settings-terms" && <SettingsTerms />}
        </div>
      </div>
    </div>
  );
}
function SettingsPreferences({
  toast,
  preferences,
  setPreferences,
  onSavePreferences,
}: {
  toast: (msg: string, type?: Toast["type"]) => void;
  preferences: AppPreferences;
  setPreferences: (p: AppPreferences) => void;
  onSavePreferences: (p: AppPreferences) => Promise<void>;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const darkMode = resolvedTheme === "dark";

  async function toggle(k: keyof AppPreferences) {
    const next = { ...preferences, [k]: !preferences[k] };
    setPreferences(next);

    try {
      await onSavePreferences(next);
      toast("Preference saved.");
    } catch (error) {
      console.error("Save preference error:", error);
      toast(error instanceof Error ? error.message : "Failed to save preference.", "error");
    }
  }

  function handleThemeToggle() {
    const newTheme = darkMode ? "light" : "dark";
    setTheme(newTheme);

    toast(
      newTheme === "dark"
        ? "Switched to dark mode."
        : "Switched to light mode.",
    );
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Preferences</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Configure notification and appearance preferences
      </p>

      <div className="mb-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Appearance
        </h3>

        <div className="flex items-center justify-between gap-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            {darkMode ? (
              <Moon className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Sun className="w-4 h-4 text-muted-foreground" />
            )}

            <div>
              <p className="font-medium text-sm">Dark mode</p>
              <p className="text-xs text-muted-foreground">
                {darkMode ? "Dark theme active" : "Light theme active"}
              </p>
            </div>
          </div>

          <Toggle checked={darkMode} onChange={handleThemeToggle} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Notifications
        </h3>

        <div className="space-y-0">
          {[
            {
              key: "emailAlerts" as const,
              label: "Email alerts",
              desc: "Receive renewal notifications by email",
            },
            {
              key: "failedAlerts" as const,
              label: "Failed renewal alerts",
              desc: "Get notified when a renewal email fails",
            },
            {
              key: "renewalAlerts" as const,
              label: "Renewal alerts",
              desc: "Notify me before contract renewal dates",
            },
            {
              key: "weeklyDigest" as const,
              label: "Weekly digest",
              desc: "Receive a weekly summary of upcoming renewals",
            },
            {
              key: "smsAlerts" as const,
              label: "SMS alerts",
              desc: "Receive important alerts by SMS",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-b-0"
            >
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>

              <Toggle
                checked={preferences[item.key]}
                onChange={() => void toggle(item.key)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const USER_ROLES = ["Administrator", "Manager", "Senior Staff", "Staff", "Viewer", "Billing Contact", "Support"];

function SettingsAccount({
  toast,
  profile,
  setProfile,
  onSaveProfile,
}: {
  toast: (msg: string, type?: Toast["type"]) => void;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onSaveProfile: (p: UserProfile) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const initials =
    profile.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  async function handleSave() {
    setSaving(true);

    try {
      await onSaveProfile(profile);
      toast("Account details saved to the database.");
    } catch (error) {
      console.error("Save account profile error:", error);
      toast(error instanceof Error ? error.message : "Failed to save account details.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Account</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Your personal account information
      </p>

      <div className="flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center text-xl font-bold">
          {initials}
        </div>

        <div>
          <p className="font-semibold">{profile.name}</p>
          <p className="text-sm text-muted-foreground">{profile.role}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Full Name
          </label>
          <input
            value={profile.name}
            onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Email
          </label>
          <input
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Phone
          </label>
          <input
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Role
          </label>

          <select
            value={profile.role}
            onChange={(e) => setProfile({ ...profile, role: e.target.value })}
            className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
          >
            {USER_ROLES.map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

function SettingsOrg({
  toast,
  profile,
  setProfile,
  onSaveProfile,
}: {
  toast: (msg: string, type?: Toast["type"]) => void;
  profile: OrganizationProfile;
  setProfile: (p: OrganizationProfile) => void;
  onSaveProfile: (p: OrganizationProfile) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    try {
      await onSaveProfile(profile);
      toast("Organisation details saved to the database.");
    } catch (error) {
      console.error("Save organisation profile error:", error);
      toast(error instanceof Error ? error.message : "Failed to save organisation details.", "error");
    } finally {
      setSaving(false);
    }
  }

  const fields: Array<{
    label: string;
    key: keyof OrganizationProfile;
    placeholder?: string;
  }> = [
    { label: "Organisation Name", key: "name" },
    { label: "Industry", key: "industry" },
    { label: "BRN Number", key: "brn" },
    { label: "VAT Number", key: "vat" },
    { label: "Website", key: "website" },
    { label: "Country", key: "country" },
  ];

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Organisation</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Details about your company
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              {field.label}
            </label>

            <input
              value={profile[field.key]}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  [field.key]: e.target.value,
                })
              }
              placeholder={field.placeholder}
              className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
            />
          </div>
        ))}

        <div className="sm:col-span-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Address
          </label>

          <input
            value={profile.address}
            onChange={(e) =>
              setProfile({
                ...profile,
                address: e.target.value,
              })
            }
            className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
          />
        </div>
      </div>

      <button
        onClick={() => void handleSave()}
        disabled={saving}
        className="mt-5 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

function SettingsSecurity({ toast }: { toast: (msg: string, type?: Toast["type"]) => void }) {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  function handlePw() {
    if (!pw.current || !pw.next) { toast("Please fill in all fields.", "error"); return; }
    if (pw.next !== pw.confirm) { toast("Passwords do not match.", "error"); return; }
    if (pw.next.length < 8) { toast("Password must be at least 8 characters.", "error"); return; }
    toast("Password updated."); setPw({ current: "", next: "", confirm: "" });
  }
  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Account & Security</h2>
      <p className="text-sm text-muted-foreground mb-6">Manage your password and security settings</p>
      <div className="space-y-5">
        <section className="border border-border rounded-xl p-4">
          <h3 className="font-semibold mb-4">Change Password</h3>
          <div className="space-y-3">
            {[{ label: "Current password", key: "current" }, { label: "New password", key: "next" }, { label: "Confirm new password", key: "confirm" }].map(f => (
              <div key={f.key}><label className="text-sm font-medium block mb-1">{f.label}</label><input type="password" placeholder="••••••••" value={(pw as any)[f.key]} onChange={e => setPw({ ...pw, [f.key]: e.target.value })} className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring" /></div>
            ))}
            <button onClick={handlePw} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90">Update Password</button>
          </div>
        </section>
        <section className="border border-red-400/30 rounded-xl p-4">
          <h3 className="font-semibold text-red-500 mb-1">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-3">Permanently delete your account</p>
          <button onClick={() => toast("Please contact support to delete your account.", "info")} className="px-4 py-2 border border-red-400/40 text-red-500 rounded-md text-sm hover:bg-red-500/10 transition-colors">Delete Account</button>
        </section>
      </div>
    </div>
  );
}

function SettingsEmail({
  toast,
  templates,
  setTemplates,
  onSaveTemplates,
}: {
  toast: (msg: string, type?: Toast["type"]) => void;
  templates: EmailTemplateSetting[];
  setTemplates: (templates: EmailTemplateSetting[]) => void;
  onSaveTemplates: (templates: EmailTemplateSetting[]) => Promise<void>;
}) {
  async function toggleTemplate(index: number) {
    const next = templates.map((template, templateIndex) =>
      templateIndex === index
        ? { ...template, active: !template.active }
        : template,
    );

    setTemplates(next);

    try {
      await onSaveTemplates(next);
      toast("Email template settings saved to the database.");
    } catch (error) {
      console.error("Save email templates error:", error);
      toast(error instanceof Error ? error.message : "Failed to save email template settings.", "error");
    }
  }

  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Email & Templates</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Configure email sending and manage templates
      </p>

      <div className="space-y-0.5">
        {templates.map((template, index) => (
          <div
            key={template.name}
            className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{template.name}</span>
            </div>

            <Toggle
              checked={template.active}
              onChange={() => void toggleTemplate(index)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsHelp() {
  const faqs = [
    { q: "How do I add a new client?", a: "Navigate to the Clients page and click 'Add Client'. Fill in the company details and save." },
    { q: "What currencies are supported?", a: "RenewalOps supports MUR (Mauritian Rupee), USD, EUR, GBP, and ZAR for contract values." },
    { q: "How do renewal reminders work?", a: "When adding a contract, set reminder days (90, 60, 30, 14, 7 days before). Emails are sent automatically on those dates." },
    { q: "Can I export contract data?", a: "Data export is available from the Admin section via Quick Actions." },
    { q: "How do I mark a contract as renewed?", a: "Open the Contract Detail page and click 'Mark as Renewed'. This updates the status and creates the next renewal period." },
  ];
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Get Help</h2>
      <p className="text-sm text-muted-foreground mb-6">Frequently asked questions</p>
      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <div key={i} className="border border-border rounded-xl overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-muted/30 text-left">
              {faq.q} {open === i ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>
            {open === i && <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border pt-3">{faq.a}</div>}
          </div>
        ))}
      </div>
      <div className="mt-6 bg-muted rounded-xl p-4">
        <p className="font-semibold text-sm mb-1">Need more help?</p>
        <a href="mailto:support@renewalops.mu" className="text-sm font-medium hover:underline">support@renewalops.mu</a>
      </div>
    </div>
  );
}

function SettingsTerms() {
  return (
    <div>
      <h2 className="font-bold text-lg mb-1">Terms & Permissions</h2>
      <p className="text-sm text-muted-foreground mb-6">Legal information and role-based access</p>
      <div className="space-y-5 text-sm text-muted-foreground">
        <section><h3 className="font-semibold text-foreground mb-2">Terms of Service</h3><p>By using RenewalOps you agree to use the platform solely for lawful contract management purposes within the Republic of Mauritius and applicable jurisdictions.</p></section>
        <section><h3 className="font-semibold text-foreground mb-2">Privacy Policy</h3><p>All client and contact data is stored securely in accordance with the Data Protection Act 2017 of Mauritius. Data is not shared with third parties without consent.</p></section>
        <section>
          <h3 className="font-semibold text-foreground mb-2">Role Permissions</h3>
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="min-w-[760px] w-full text-sm">
              <thead><tr className="bg-muted/40 border-b border-border">{["Role", "View", "Edit", "Delete", "Admin"].map(h => <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {[["Administrator", "✓", "✓", "✓", "✓"], ["Manager", "✓", "✓", "✗", "✗"], ["Viewer", "✓", "✗", "✗", "✗"]].map(row => (
                  <tr key={row[0]}>{row.map((cell, i) => <td key={i} className="px-4 py-2 text-xs">{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────

function AdminPage({
  toast,
  profile,
  setProfile,
  onSaveProfile,
  preferences,
  setPreferences,
  onSavePreferences,
}: {
  toast: (msg: string, type?: Toast["type"]) => void;
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;
  onSaveProfile: (p: UserProfile) => Promise<void>;
  preferences: AppPreferences;
  setPreferences: (p: AppPreferences) => void;
  onSavePreferences: (p: AppPreferences) => Promise<void>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const initials =
    profile.name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  async function saveProfile() {
    setSaving(true);

    try {
      await onSaveProfile(profile);
      setEditOpen(false);
      toast("Profile updated in the database.");
    } catch (error) {
      console.error("Admin profile save error:", error);
      toast(error instanceof Error ? error.message : "Failed to save profile.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function togglePref(key: keyof AppPreferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);

    try {
      await onSavePreferences(next);
      toast("Preference saved to the database.");
    } catch (error) {
      console.error("Admin preference save error:", error);
      toast(error instanceof Error ? error.message : "Failed to save preference.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your personal account
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Profile Summary</h2>
              <button
                onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-md text-sm hover:bg-accent"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>

            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-foreground/10 flex items-center justify-center text-xl font-bold shrink-0">
                {initials}
              </div>

              <div>
                <p className="font-bold text-lg">{profile.name}</p>
                <p className="text-sm text-muted-foreground">{profile.role}</p>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Personal Information</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: "Full Name", value: profile.name },
                { label: "Email", value: profile.email },
                { label: "Phone", value: profile.phone },
                { label: "Role", value: profile.role },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
                    {item.label}
                  </dt>
                  <dd className="font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Notification Preferences</h2>
            {[
              {
                key: "emailAlerts" as const,
                label: "Email alerts",
                desc: "Renewal notifications via email",
              },
              {
                key: "failedAlerts" as const,
                label: "Failed email alerts",
                desc: "When a renewal email fails",
              },
              {
                key: "renewalAlerts" as const,
                label: "Upcoming renewal alerts",
                desc: "30-day advance notifications",
              },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>

                <Toggle checked={preferences[key]} onChange={() => void togglePref(key)} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-3">Quick Actions</h2>
            <div className="space-y-1">
              <button
                onClick={() => toast("Password change — go to Settings → Security.", "info")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Lock className="w-4 h-4" /> Change Password
              </button>

              <button
                onClick={() => toast("Your data export will be ready shortly.", "info")}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" /> Export My Data
              </button>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <RenewalOpsLogo size="xs" />
            <p className="text-xs text-muted-foreground mt-3">
              RenewalOps v1.0.0
              <br />© 2026 RenewalOps (Mauritius) Ltd
            </p>
          </div>
        </div>
      </div>

      {editOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 backdrop-blur-sm px-3 py-6 sm:px-6 sm:py-10">
          <div className="mx-auto bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">Edit Profile</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="p-1 rounded hover:bg-accent"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">Full Name</label>
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <input
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Phone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Role</label>
                <select
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm outline-none focus:ring-2 ring-ring"
                >
                  {USER_ROLES.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setEditOpen(false)}
                className="flex-1 py-2 border border-border rounded-md text-sm hover:bg-accent"
              >
                Cancel
              </button>

              <button
                onClick={() => void saveProfile()}
                disabled={saving}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── NOTIFICATIONS PAGE ───────────────────────────────────────────────────────

function NotificationsPage({ notifications, setNotifications }: { notifications: Notification[]; setNotifications: (n: Notification[]) => void }) {
  const [showArchived, setShowArchived] = useState(false);
  const [openNotif, setOpenNotif] = useState<Notification | null>(null);

  const visible = notifications.filter(n => showArchived ? n.archived : !n.archived);
  const unreadCount = notifications.filter(n => !n.read && !n.archived).length;

  function markRead(id: string) { setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n)); }
  function archive(id: string) { setNotifications(notifications.map(n => n.id === id ? { ...n, archived: true } : n)); if (openNotif?.id === id) setOpenNotif(null); }
  function unarchive(id: string) { setNotifications(notifications.map(n => n.id === id ? { ...n, archived: false } : n)); if (openNotif?.id === id) setOpenNotif(prev => prev ? { ...prev, archived: false } : null); }
  function del(id: string) { setNotifications(notifications.filter(n => n.id !== id)); if (openNotif?.id === id) setOpenNotif(null); }
  function markAllRead() { setNotifications(notifications.map(n => ({ ...n, read: true }))); }

  function openAndRead(n: Notification) { markRead(n.id); setOpenNotif(n); }

  const typeIcon = (type: Notification["type"]) => {
    if (type === "overdue" || type === "alert") return <AlertTriangle className="w-4 h-4" />;
    if (type === "renewal") return <RefreshCw className="w-4 h-4" />;
    return <Bell className="w-4 h-4" />;
  };
  const typeBg = (type: Notification["type"]) => ({
    overdue: "bg-red-500/10 text-red-500", alert: "bg-zinc-500/10 text-zinc-500",
    renewal: "bg-foreground/10 text-foreground", info: "bg-zinc-400/10 text-zinc-500",
  }[type]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {showArchived && (
            <button onClick={() => { setShowArchived(false); setOpenNotif(null); }}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors" title="Back to active notifications">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold">{showArchived ? "Archived Notifications" : "Notifications"}</h1>
            <p className="text-muted-foreground text-sm mt-1">{showArchived ? `${visible.length} archived` : `${unreadCount} unread`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!showArchived && <button onClick={markAllRead} className="px-3 py-2 border border-border rounded-md text-sm hover:bg-accent text-muted-foreground">Mark all read</button>}
          <button onClick={() => { setShowArchived(!showArchived); setOpenNotif(null); }}
            className={cn("px-3 py-2 border border-border rounded-md text-sm transition-colors", showArchived ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground")}>
            {showArchived ? "View Active" : "Archived"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className={cn("space-y-2", openNotif ? "lg:col-span-2" : "lg:col-span-5")}>
          {visible.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{showArchived ? "No archived notifications" : "You're all caught up"}</p>
            </div>
          )}
          {visible.map(n => (
            <div key={n.id} onClick={() => openAndRead(n)}
              className={cn("bg-card border rounded-xl p-4 flex gap-3 cursor-pointer transition-all hover:shadow-sm",
                openNotif?.id === n.id ? "border-foreground/30" : !n.read ? "border-foreground/20" : "border-border",
                n.type === "overdue" && "border-l-4 border-l-red-500")}>
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", typeBg(n.type))}>{typeIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-sm font-semibold truncate", !n.read && "text-foreground")}>{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-foreground shrink-0 mt-1.5" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground">{n.time}</span>
                  {!n.archived ? (
                    <button onClick={e => { e.stopPropagation(); archive(n.id); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      <Archive className="w-3 h-3" /> Archive
                    </button>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); unarchive(n.id); }} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      <RotateCcw className="w-3 h-3" /> Unarchive
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); del(n.id); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {openNotif && (
          <div className="xl:col-span-3 bg-card border border-border rounded-xl p-6 page-enter">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", typeBg(openNotif.type))}>{typeIcon(openNotif.type)}</div>
              <button onClick={() => setOpenNotif(null)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <h2 className="font-bold text-lg mb-1">{openNotif.title}</h2>
            <p className="text-xs text-muted-foreground mb-4 font-mono">{openNotif.time}</p>
            <p className="text-sm leading-relaxed mb-6">{openNotif.detail || openNotif.message}</p>
            <div className="flex gap-2 pt-4 border-t border-border flex-wrap">
              {!openNotif.archived ? (
                <button onClick={() => archive(openNotif.id)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent text-muted-foreground">
                  <Archive className="w-3.5 h-3.5" /> Archive
                </button>
              ) : (
                <button onClick={() => unarchive(openNotif.id)} className="flex items-center gap-2 px-3 py-2 border border-border rounded-md text-sm hover:bg-accent text-muted-foreground">
                  <RotateCcw className="w-3.5 h-3.5" /> Unarchive
                </button>
              )}
              <button onClick={() => del(openNotif.id)} className="flex items-center gap-2 px-3 py-2 border border-red-400/50 text-red-500 rounded-md text-sm hover:bg-red-500/10">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  //const [loading, setLoading] = useState(true);
  //const [isLoggedIn, setIsLoggedIn] = useState(false);
  //const [page, setPage] = useState<Page>("login");
  const pathname = usePathname();
  const router = useRouter();

  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();


  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");

  const [clients, setClients] = useState<Client[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [notificationOverrides, setNotificationOverrides] = useState<
  Record<string, NotificationOverride>
>({});
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsSubpage, setSettingsSubpage] = useState<Page>("settings");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  //const [userProfile, setUserProfile] = useState({ name: "John Doe", email: "john@company.mu", phone: "+230 5XXX XXXX", role: "Administrator" });
const [userProfile, setUserProfile] = useState<UserProfile>(() => {
  return getStoredJson<UserProfile>(USER_PROFILE_STORAGE_KEY) ?? DEFAULT_USER_PROFILE;
});

const [organizationProfile, setOrganizationProfile] = useState<OrganizationProfile>(() => {
  return (
    getStoredJson<OrganizationProfile>(ORGANIZATION_PROFILE_STORAGE_KEY) ??
    DEFAULT_ORGANIZATION_PROFILE
  );
});

const [preferences, setPreferences] = useState<AppPreferences>(() => {
  return (
    getStoredJson<AppPreferences>(APP_PREFERENCES_STORAGE_KEY) ??
    DEFAULT_APP_PREFERENCES
  );
});

const [emailTemplates, setEmailTemplates] = useState<EmailTemplateSetting[]>(() => {
  return (
    getStoredJson<EmailTemplateSetting[]>(EMAIL_TEMPLATES_STORAGE_KEY) ??
    DEFAULT_EMAIL_TEMPLATES
  );
});
 const { toasts, add: addToast, remove: removeToast } = useToast();
useEffect(() => {
  if (!isLoaded) return;

  let mounted = true;

  async function loadSavedSettings() {
    const clerkProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      name: user?.fullName || DEFAULT_USER_PROFILE.name,
      email: user?.primaryEmailAddress?.emailAddress || DEFAULT_USER_PROFILE.email,
    };

    const localUserProfile =
      getStoredJson<UserProfile>(USER_PROFILE_STORAGE_KEY) ?? clerkProfile;
    const localOrganizationProfile =
      getStoredJson<OrganizationProfile>(ORGANIZATION_PROFILE_STORAGE_KEY) ??
      DEFAULT_ORGANIZATION_PROFILE;
    const localPreferences =
      getStoredJson<AppPreferences>(APP_PREFERENCES_STORAGE_KEY) ??
      DEFAULT_APP_PREFERENCES;
    const localEmailTemplates =
      getStoredJson<EmailTemplateSetting[]>(EMAIL_TEMPLATES_STORAGE_KEY) ??
      DEFAULT_EMAIL_TEMPLATES;

    if (!mounted) return;

    setUserProfile({ ...clerkProfile, ...localUserProfile });
    setOrganizationProfile({
      ...DEFAULT_ORGANIZATION_PROFILE,
      ...localOrganizationProfile,
    });
    setPreferences({ ...DEFAULT_APP_PREFERENCES, ...localPreferences });
    setEmailTemplates(localEmailTemplates);

    try {
      const databaseSettings = await fetchDatabaseSettings();

      if (!mounted) return;

      if (databaseSettings.accountProfile) {
        const savedProfile = {
          ...clerkProfile,
          ...databaseSettings.accountProfile,
        };
        setUserProfile(savedProfile);
        saveStoredJson(USER_PROFILE_STORAGE_KEY, savedProfile);
      }

      if (databaseSettings.organizationProfile) {
        const savedOrganization = {
          ...DEFAULT_ORGANIZATION_PROFILE,
          ...databaseSettings.organizationProfile,
        };
        setOrganizationProfile(savedOrganization);
        saveStoredJson(ORGANIZATION_PROFILE_STORAGE_KEY, savedOrganization);
      }

      if (databaseSettings.preferences) {
        const savedPreferences = {
          ...DEFAULT_APP_PREFERENCES,
          ...databaseSettings.preferences,
        };
        setPreferences(savedPreferences);
        saveStoredJson(APP_PREFERENCES_STORAGE_KEY, savedPreferences);
      }

      if (Array.isArray(databaseSettings.emailTemplates)) {
        setEmailTemplates(databaseSettings.emailTemplates);
        saveStoredJson(EMAIL_TEMPLATES_STORAGE_KEY, databaseSettings.emailTemplates);
      }
    } catch (error) {
      console.warn("Settings API not available yet. Using browser fallback.", error);
    }
  }

  void loadSavedSettings();

  return () => {
    mounted = false;
  };
}, [isLoaded, user?.id]);

const notifications = buildNotificationsFromContracts(
  contracts,
  notificationOverrides,
);

const unreadCount = notifications.filter(
  (notification) => !notification.read && !notification.archived,
).length;

const setGeneratedNotifications = useCallback(
  (updatedNotifications: Notification[]) => {
    setNotificationOverrides((previous) => {
      const next = { ...previous };
      const updatedIds = new Set(
        updatedNotifications.map((notification) => notification.id),
      );

      for (const notification of updatedNotifications) {
        next[notification.id] = {
          ...next[notification.id],
          read: notification.read,
          archived: notification.archived,
        };
      }

      for (const notification of notifications) {
        if (!updatedIds.has(notification.id)) {
          next[notification.id] = {
            ...next[notification.id],
            deleted: true,
          };
        }
      }

      return next;
    });
  },
  [notifications],
);
useEffect(() => {
  async function loadDatabaseData() {
    try {
      const clientsResponse = await fetch("/api/clients", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const clientsData = await readApiJson(clientsResponse, "/api/clients");
      setClients(listFromApi(clientsData, "clients").map(normalizeClient));
    } catch (error) {
      console.error("Failed to load clients:", error);
    }

    try {
      const contactsResponse = await fetch("/api/contacts", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const contactsData = await readApiJson(contactsResponse, "/api/contacts");
      setContacts(listFromApi(contactsData, "contacts").map(normalizeContact));
    } catch (error) {
      console.error("Failed to load contacts:", error);
    }

    try {
      const contractsResponse = await fetch("/api/contracts", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const contractsData = await readApiJson(contractsResponse, "/api/contracts");
      setContracts(listFromApi(contractsData, "contracts").map(normalizeContract));
    } catch (error) {
      console.error("Failed to load contracts:", error);
    }
  }

  loadDatabaseData();
  const interval = window.setInterval(loadDatabaseData, 5000);
  return () => window.clearInterval(interval);
}, []);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 2400); return () => clearTimeout(t); }, []);
  useEffect(() => { if (!searchQuery) setSearchOpen(false); else setSearchOpen(true); }, [searchQuery]);

  useEffect(() => {
  if (!isSignedIn) return;

  if (pathname.startsWith("/clients")) {
    setPage("clients");
  } else if (pathname.startsWith("/contracts")) {
    setPage("contracts");
  } else if (pathname.startsWith("/settings")) {
    setPage("settings");
  } else {
    setPage("dashboard");
  }
}, [isSignedIn, pathname]);
  const saveUserProfile = useCallback(async (profile: UserProfile) => {
    const nextProfile = { ...DEFAULT_USER_PROFILE, ...profile };

    setUserProfile(nextProfile);
    saveStoredJson(USER_PROFILE_STORAGE_KEY, nextProfile);

    await saveDatabaseSetting("accountProfile", nextProfile);
  }, []);

  const saveOrganizationProfile = useCallback(async (profile: OrganizationProfile) => {
    const nextProfile = { ...DEFAULT_ORGANIZATION_PROFILE, ...profile };

    setOrganizationProfile(nextProfile);
    saveStoredJson(ORGANIZATION_PROFILE_STORAGE_KEY, nextProfile);

    await saveDatabaseSetting("organizationProfile", nextProfile);
  }, []);

  const savePreferences = useCallback(async (nextPreferences: AppPreferences) => {
    const mergedPreferences = { ...DEFAULT_APP_PREFERENCES, ...nextPreferences };

    setPreferences(mergedPreferences);
    saveStoredJson(APP_PREFERENCES_STORAGE_KEY, mergedPreferences);

    await saveDatabaseSetting("preferences", mergedPreferences);
  }, []);

  const saveEmailTemplates = useCallback(async (templates: EmailTemplateSetting[]) => {
    setEmailTemplates(templates);
    saveStoredJson(EMAIL_TEMPLATES_STORAGE_KEY, templates);

    await saveDatabaseSetting("emailTemplates", templates);
  }, []);

  const navigate = useCallback((to: Page) => setPage(to), []);

  function handleNav(p: Page) {
    if (p === "settings") setSettingsSubpage("settings");
    navigate(p); setSearchQuery(""); setSearchOpen(false);
     setPage(p);
  setSidebarOpen(false);
  }

  async function handleSignOut() {
  setSignOutOpen(false);
  await signOut();
  navigate("dashboard");
  addToast("You have been signed out.", "info");
  router.push("/");
}

  const GLOBAL_CSS = `
    @keyframes blockDrop { from { opacity: 0; transform: translateY(-12px) scale(0.8); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes dotPulse { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1); } }
    @keyframes orbit { from { transform: translate(-50%,-50%) rotate(0deg) translateX(var(--orbit-r)) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg); } }
    @keyframes floatSlow { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-18px) rotate(3deg); } }
    @keyframes toastIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pageEnter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes edgePulse { 0%, 100% { stroke-opacity: 0.04; } 50% { stroke-opacity: 0.22; } }
    @keyframes nodePing { 0% { transform: scale(1); stroke-opacity: 0.5; } 100% { transform: scale(6); stroke-opacity: 0; } }
    @keyframes dotGlow { 0%, 100% { fill-opacity: 0.2; } 50% { fill-opacity: 0.55; } }
    @keyframes logoRing { 0%, 100% { opacity: 0.15; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.18); } }
    @keyframes handCycle {
      0%   { transform: rotate(0deg)   scale(1);    opacity: 0.82; }
      18%  { transform: rotate(-14deg) scale(1.13); opacity: 0.9;  }
      38%  { transform: rotate(7deg)   scale(0.91); opacity: 0.75; }
      62%  { transform: rotate(13deg)  scale(1.1);  opacity: 0.88; }
      82%  { transform: rotate(2deg)   scale(1.03); opacity: 0.85; }
      100% { transform: rotate(0deg)   scale(1);    opacity: 0.82; }
    }
    .page-enter { animation: pageEnter 0.22s cubic-bezier(0.16,1,0.3,1) both; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 9999px; }
    body { font-family: 'Inter', system-ui, sans-serif; }
  `;

 if (loading || !isLoaded) {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoadingScreen />
    </>
  );
}
if (!isSignedIn) {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoginPage />
      <ToastContainer toasts={toasts} remove={removeToast} />
    </>
  );
}

 return (
  <>
    <style>{GLOBAL_CSS}</style>

    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        current={page}
        onNav={handleNav}
        onSignOut={() => setSignOutOpen(true)}
        userProfile={userProfile}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full ml-0 xl:ml-60">
        <TopBar
          onSearch={() => setSearchOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNotifications={() => handleNav("notifications")}
          notifCount={unreadCount}
          onAdmin={() => handleNav("admin")}
          userProfile={userProfile}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto pt-16">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 xl:px-6 py-4 xl:py-6">
            <PageWrapper pageKey={page}>
              {page === "dashboard" && (
                <DashboardPage
                  clients={clients}
                  contracts={contracts}
                  onNav={handleNav}
                />
              )}

              {page === "clients" && (
                <ClientsPage
                  clients={clients}
                  setClients={setClients}
                  onDetail={(c) => {
                    setSelectedClient(c);
                    navigate("client-detail");
                  }}
                  toast={addToast}
                />
              )}

              {page === "client-detail" && selectedClient && (
                <ClientDetailPage
                  client={selectedClient}
                  clients={clients}
                  contacts={contacts}
                  setClients={setClients}
                  onBack={() => navigate("clients")}
                  onNav={handleNav}
                  toast={addToast}
                />
              )}

           

              {page === "contracts" && (
                <ContractsPage
                  contracts={contracts}
                  clients={clients}
                  contacts={contacts}
                  setContracts={setContracts}
                  onDetail={(c) => {
                    setSelectedContract(c);
                    navigate("contract-detail");
                  }}
                  toast={addToast}
                />
              )}

              {page === "contract-detail" && selectedContract && (
                <ContractDetailPage
                  contract={selectedContract}
                  contracts={contracts}
                  contacts={contacts}
                  setContracts={setContracts}
                  onBack={() => navigate("contracts")}
                  toast={addToast}
                />
              )}

              {(page === "settings" || page.startsWith("settings-")) && (
            <SettingsPage
  subpage={settingsSubpage}
  onSubpage={(p) => {
    setSettingsSubpage(p);
    navigate(p);
  }}
  toast={addToast}
  userProfile={userProfile}
  setUserProfile={setUserProfile}
  onSaveUserProfile={saveUserProfile}
  organizationProfile={organizationProfile}
  setOrganizationProfile={setOrganizationProfile}
  onSaveOrganizationProfile={saveOrganizationProfile}
  preferences={preferences}
  setPreferences={setPreferences}
  onSavePreferences={savePreferences}
  emailTemplates={emailTemplates}
  setEmailTemplates={setEmailTemplates}
  onSaveEmailTemplates={saveEmailTemplates}
/>
              )}

              {page === "admin" && (
                <AdminPage
                  toast={addToast}
                  profile={userProfile}
                  setProfile={setUserProfile}
                  onSaveProfile={saveUserProfile}
                  preferences={preferences}
                  setPreferences={setPreferences}
                  onSavePreferences={savePreferences}
                />
              )}

              {page === "notifications" && (
                <NotificationsPage
                  notifications={notifications}
                  setNotifications={setGeneratedNotifications}
                />
              )}
            </PageWrapper>
          </div>
        </main>
      </div>

      {searchOpen && searchQuery && (
        <SearchOverlay
          query={searchQuery}
          clients={clients}
          contacts={contacts}
          contracts={contracts}
          onClose={() => {
            setSearchOpen(false);
            setSearchQuery("");
          }}
          onNav={handleNav}
        />
      )}

      {signOutOpen && (
        <SignOutModal
          onConfirm={handleSignOut}
          onCancel={() => setSignOutOpen(false)}
        />
      )}
    </div>

    <ToastContainer toasts={toasts} remove={removeToast} />
  </>
);
}