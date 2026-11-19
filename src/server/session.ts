import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function currentAccountId(): Promise<string | null> {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

export async function requireAccountId(): Promise<string> {
  const id = await currentAccountId();
  if (!id) redirect("/login");
  return id;
}
