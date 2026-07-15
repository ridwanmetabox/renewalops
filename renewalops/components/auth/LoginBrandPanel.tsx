"use client";

function LogoMark({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
    >
      <rect x="2" y="2" width="22" height="6" fill="currentColor" />
      <rect x="2" y="32" width="22" height="6" fill="currentColor" />
      <rect x="2" y="2" width="6" height="36" fill="currentColor" />
      <rect x="14" y="14" width="10" height="12" fill="currentColor" />
      <rect x="28" y="2" width="6" height="6" fill="currentColor" />
      <rect x="34" y="8" width="6" height="6" fill="currentColor" />
    </svg>
  );
}

function RenewalOpsLogo({
  size = "lg",
  showText = true,
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
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
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-white border border-[#D8E7EF] shadow-md flex items-center justify-center">
        <LogoMark size={s.mark} className="text-[#1F3B73] shrink-0" />
      </div>

      {showText && (
        <div className="leading-none">
          <div
            className={`font-black tracking-tight uppercase text-[#1F3B73] ${s.name}`}
          >
            RENEWALOPS
          </div>
          <div
            className={`font-semibold tracking-[0.15em] uppercase text-[#30B7AE] mt-1 ${s.sub}`}
          >
            Since 2026
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginBrandPanel() {
  return (
    <aside className="hidden lg:flex w-[46%] min-h-screen relative overflow-hidden bg-white border-r border-[#D8E7EF]">
      <div className="absolute inset-0 metabox-soft-bg" />

      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-[#30B7AE]/20 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-[#1F3B73]/15 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between w-full p-12">
        <RenewalOpsLogo size="lg" />

        <div className="max-w-xl">
          <p className="text-sm font-bold text-[#30B7AE] mb-4">
            Contract Renewal Management
          </p>

          <h1 className="text-5xl font-black leading-tight text-[#15233F] mb-6">
            Manage renewals with a cleaner, faster workflow.
          </h1>

          <p className="text-lg text-slate-600 leading-8">
            Track contracts, clients, reminders, email history, and renewal
            actions in one professional dashboard.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10">
            <div className="rounded-2xl bg-white border border-[#D8E7EF] p-4 shadow-sm">
              <p className="text-2xl font-black text-[#1F3B73]">90</p>
              <p className="text-xs text-slate-500 mt-1">Day reminders</p>
            </div>

            <div className="rounded-2xl bg-white border border-[#D8E7EF] p-4 shadow-sm">
              <p className="text-2xl font-black text-[#30B7AE]">24/7</p>
              <p className="text-xs text-slate-500 mt-1">Tracking</p>
            </div>

            <div className="rounded-2xl bg-white border border-[#D8E7EF] p-4 shadow-sm">
              <p className="text-2xl font-black text-[#54C7A5]">Auto</p>
              <p className="text-xs text-slate-500 mt-1">Email alerts</p>
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          © 2026 RenewalOps. Designed with MetaBox Technology colors.
        </div>
      </div>
    </aside>
  );
}