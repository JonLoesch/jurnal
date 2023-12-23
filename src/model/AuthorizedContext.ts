import { Prisma, PrismaClient } from "@prisma/client";
import { Immutable } from "immer";
import { Session } from "next-auth";
import { MetricType } from "~/lib/metricSchemas";

type GlobalContext = {
  prisma: PrismaClient;
  session: Session | null;
};

type OptionalAuthContext = {
  journal: Roles<{id: number}>;
  post: Roles<{id: number}>;
  metric: Roles<{id: string, metricType: MetricType}>;
};
type Roles<T extends Record<string, unknown>> = {
  read: boolean;
  write: boolean;
} & T;

export type AuthorizedContextKey = Array<keyof OptionalAuthContext>;
export type AuthorizedContext<Key extends AuthorizedContextKey> =
  GlobalContext & {
    _auth: Pick<OptionalAuthContext, Key[number]>;
  };

export function _perms<Key extends AuthorizedContextKey>(
  context: AuthorizedContext<Key>,
  check: Immutable<Key>,
): Array<{ read: boolean; write: boolean }> {
  return check.map((k) => (context._auth as OptionalAuthContext)[k]);
}
