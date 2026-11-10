import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { signedInUser } from "@/lib/auth";
import { signOut } from "./login/actions";
import { demoMode } from "@/lib/demo";
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
  { href: "/problems", label: "Problem Bank" },
  { href: "/schedule", label: "Schedule" },
  { href: "/logs", label: "Logs" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await signedInUser();
  const demo = demoMode();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        {demo.on && (
          <div className="bg-amber-400 px-4 py-1.5 text-center text-sm font-medium text-amber-950">
            DEMO MODE · every email this platform sends goes only to {demo.recipient || "the demo address (not set yet)"}. Nothing goes to Grace, the reviewer or the list.
          </div>
        )}
        {user && (
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
              <Link href="/" className="-mx-2 rounded-lg px-2 py-1 font-semibold tracking-tight transition hover:bg-slate-100 hover:shadow-sm">
                The Pack Leader <span className="text-slate-400">· Approvals</span>
              </Link>
              <nav className="flex flex-wrap gap-1 text-sm text-slate-600">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-md px-3 py-1.5 transition hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm hover:ring-1 hover:ring-slate-200"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
              <div className="ml-auto flex items-center gap-3 text-sm text-slate-600">
                <span>
                  Signed in as <span className="font-medium text-slate-900">{user.name}</span>{" "}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ROLE_LABEL[user.role]}</span>
                </span>
                <form action={signOut}>
                  <button className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
