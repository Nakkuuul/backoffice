import type { IconName } from "@/lib/nav/manifest";

const PATHS: Record<IconName, React.ReactNode> = {
  home: <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  clients: (
    <>
      <path d="M3 20h18M5 20V9l7-4 7 4v11" />
      <path d="M9 20v-5h6v5M8.5 12h0M12 12h0M15.5 12h0" />
    </>
  ),
  ekyc: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5.5 16c.6-1.6 2-2.3 3-2.3s2.4.7 3 2.3M14 9.5h4M14 12.5h4M14 15.5h2.5" />
    </>
  ),
  accounting: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 8h5M9.5 10.5h5M9.5 8c2.6 0 3 3 0 3h-.2l3.7 5" />
    </>
  ),
  reports: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 16v-3M12 16v-5M15 16v-2" />
    </>
  ),
  documents: <path d="M16 7.5 9.3 14a2.3 2.3 0 0 0 3.2 3.2L19 10a4 4 0 0 0-5.6-5.6l-7 7a6 6 0 0 0 8.4 8.4l5.2-5.2" />,
  esign: (
    <>
      <path d="M5 19h14" />
      <path d="M7 16 16.5 6.5a2 2 0 0 1 3 3L10 19l-4 1 1-4z" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c.5-3 2.8-4.5 5.5-4.5s5 1.5 5.5 4.5" />
      <circle cx="17.5" cy="9.5" r="2" />
      <path d="M15.5 14.2c2.4-.4 4.3 1 4.8 3.3" />
    </>
  ),
  system: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </>
  ),
  self: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5" />
    </>
  ),
};

export function NavIcon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
