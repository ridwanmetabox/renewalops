export const clerkAppearance = {
  variables: {
    colorPrimary: "#30B7AE",
    colorBackground: "#FFFFFF",
    colorText: "#15233F",
    colorTextSecondary: "#64748B",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#15233F",
    colorDanger: "#EF4444",
    borderRadius: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox:
      "w-full shadow-2xl border border-[#D8E7EF] bg-white rounded-3xl overflow-hidden",
    card: "bg-white shadow-none px-8 py-8",

    header: "text-center mb-6",
    headerTitle: "text-[#15233F] text-xl font-bold",
    headerSubtitle: "text-[#64748B] text-sm",

    socialButtonsBlockButton:
      "h-11 rounded-xl border border-[#D8E7EF] bg-white hover:bg-[#E6FAF7] text-[#15233F] shadow-sm",
    socialButtonsBlockButtonText:
      "text-[#15233F] font-medium text-sm",

    dividerLine: "bg-[#D8E7EF]",
    dividerText: "text-[#64748B] text-sm",

    formFieldLabel: "text-[#15233F] text-sm font-medium",
    formFieldInput:
      "h-11 rounded-xl border border-[#D8E7EF] bg-white text-[#15233F] placeholder:text-[#94A3B8] focus:border-[#30B7AE] focus:ring-[#30B7AE]",

    formButtonPrimary:
      "h-11 rounded-xl bg-[#30B7AE] hover:bg-[#269D96] text-white font-semibold shadow-md shadow-[#30B7AE]/20",

    footer: "bg-[#F8FBFF] border-t border-[#E5EEF5]",
    footerActionText: "text-[#64748B]",
    footerActionLink:
      "text-[#30B7AE] hover:text-[#1F3B73] font-semibold",

    identityPreviewText: "text-[#15233F]",
    identityPreviewEditButton: "text-[#30B7AE]",

    formFieldAction: "text-[#1F3B73] hover:text-[#30B7AE]",
    formFieldInputShowPasswordButton: "text-[#64748B]",

    alertText: "text-sm",
  },
};