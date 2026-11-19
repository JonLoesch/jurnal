import { notFound } from "next/navigation";
import { UserError } from "./errors";

/** In a page: turn "not found / no access" from the services into a proper 404 page. */
export async function orNotFound<T>(work: Promise<T>): Promise<T> {
  try {
    return await work;
  } catch (e) {
    if (e instanceof UserError && e.status === 404) notFound();
    throw e;
  }
}
