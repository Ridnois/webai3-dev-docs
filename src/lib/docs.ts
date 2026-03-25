export interface NavItem {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Developer Reference",
    items: [
      { title: "System Architecture", href: "/docs/architecture" },
      { title: "AIC Token Contract", href: "/docs/aic-token-contract" },
      { title: "Presale System", href: "/docs/presale-system" },
      { title: "Fund Routing & Vaults", href: "/docs/fund-routing" },
      { title: "Token ↔ App Integration", href: "/docs/token-app-integration" },
      { title: "Inference Payment Pipeline", href: "/docs/inference-pipeline" },
      { title: "Local Development", href: "/docs/local-development" },
      { title: "Contract Deployment", href: "/docs/deployment" },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Pre-Release Checklist", href: "/docs/operations/pre-release" },
      { title: "Token Presale Checklist", href: "/docs/operations/landing-release-check" },
      { title: "Mainnet Deploy Plan", href: "/docs/operations/deploy-plan" },
    ],
  },
  {
    title: "Devlog",
    items: [
      { title: "Landing App Overhaul — Mar 2026", href: "/docs/devlog/landing-overhaul-mar-2026" },
      { title: "Fix Plan: Hardcoded Prices", href: "/docs/devlog/hardcoded-prices-fix" },
      { title: "Landing: Prices Fix & Live Phase", href: "/docs/devlog/landing-live-phase-mar-2026" },
      { title: "Landing: Product-First Metadata", href: "/docs/devlog/landing-metadata-mar-2026" },
      { title: "Landing: Internationalization Plan", href: "/docs/devlog/landing-i18n-plan" },
    ],
  },
];

export function extractToc(html: string): { id: string; text: string; level: number }[] {
  const headingRegex = /<h([23])[^>]*id="([^"]*)"[^>]*>(.*?)<\/h[23]>/gi;
  const toc: { id: string; text: string; level: number }[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const id = match[2];
    const text = match[3].replace(/<[^>]+>/g, "");
    toc.push({ id, text, level });
  }
  return toc;
}
