"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TIMEZONES, TZ_COOKIE } from "@/lib/timezone";
import { safeNext } from "@/lib/session";

export async function setTimezone(formData: FormData) {
  const tz = String(formData.get("tz") ?? "");
  if (TIMEZONES.some((t) => t.id === tz)) {
    (await cookies()).set(TZ_COOKIE, tz, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
  }
  redirect(safeNext(formData.get("back")));
}
