import type { Metadata } from "next";
import { Geist_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import { signedInUser } from "@/lib/auth";
import { signOut } from "./login/actions";
import { demoMode } from "@/lib/demo";
import { ROLE_LABEL } from "@/lib/types";
import "./globals.css";

const body = Public_Sans({ variable: "--font-body", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CBI Newsletter",
  description: "Write, approve and schedule The Pack Leader, CBI K9's weekly email.",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/problems", label: "Content ideas" },
  { href: "/schedule", label: "Send schedule" },
  { href: "/logs", label: "History" },
];

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await signedInUser();
  const demo = demoMode();
  return (
    <html lang="en" className={`${body.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 text-slate-900">
        {demo.on && (
          <div className="bg-amber-400 px-4 py-1.5 text-center text-sm font-medium text-amber-950">
            Test mode: every email goes only to {demo.recipient || "the test address (not set yet)"}. Nothing reaches Grace, the reviewer or the mailing list.
          </div>
        )}
        {user && (
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
              <Link href="/" className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1 text-lg font-bold transition hover:bg-slate-100 hover:shadow-sm">
                <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-base text-white">🐾</span>
                CBI Newsletter
              </Link>
              <nav className="flex flex-wrap gap-1 text-sm font-medium text-slate-700">
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
                  Hi, <span className="font-semibold text-slate-900">{user.name}</span>{" "}
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{ROLE_LABEL[user.role]}</span>
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
