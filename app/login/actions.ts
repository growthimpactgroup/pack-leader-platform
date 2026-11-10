"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_DAYS, checkLogin, createSession, safeNext } from "@/lib/session";

export async function signIn(formData: FormData) {
  const user = String(formData.get("username") ?? "").trim();
  const pass = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const account = checkLogin(user, pass);
  if (!account) {
    await new Promise((r) => setTimeout(r, 600)); // slows down password guessing
    const q = new URLSearchParams({ error: "That username and password don't match." });
    if (next !== "/") q.set("next", next);
    redirect(`/login?${q}`);
  }
  (await cookies()).set(SESSION_COOKIE, await createSession(account), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  redirect(next);
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login?signedOut=1");
}
