import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pack Leader — Approvals",
  description: "Approval and scheduling for The Pack Leader, CBI K9's weekly email.",
};

const NAV = [
  { href: "/", label: "Pipeline" },
  { href: "/schedule", label: "Schedule" },
  { href: "/logs", label: "Logs" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              The Pack Leader <span className="text-slate-400">· Approvals</span>
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-slate-900">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto text-sm text-slate-600">
              Signed in as <span className="font-medium text-slate-900">{user.name}</span>{" "}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ROLE_LABEL[user.role]}</span>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
