import { redirect } from "next/navigation";
import { createIssue } from "@/app/actions";
import { ErrorBox } from "@/app/ui";
import { currentUser } from "@/lib/auth";
import { formatDate, upcomingWednesdays } from "@/lib/schedule";
import { readDb } from "@/lib/store";

export default async function NewIssuePage({ searchParams }: PageProps<"/issues/new">) {
  const [user, db, params] = await Promise.all([currentUser(), readDb(), searchParams]);
  if (user.role !== "operator") redirect("/");
  const taken = new Set(db.issues.map((i) => i.issueDate));
  const options = upcomingWednesdays(8).filter((d) => !taken.has(d));
  const nextNumber = db.issues.reduce((max, i) => Math.max(max, i.number), 0) + 1;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New issue · Pack Leader #{nextNumber}</h1>
      <ErrorBox message={typeof params.error === "string" ? params.error : undefined} />
      <form action={createIssue} className="card space-y-4">
        <div>
          <label className="label" htmlFor="issueDate">
            Send date (Wednesday)
          </label>
          <select id="issueDate" name="issueDate" className="input" required>
            {options.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Wednesdays that already have an issue are left out.</p>
        </div>
        <button className="btn-primary">Create draft</button>
      </form>
    </div>
  );
}
