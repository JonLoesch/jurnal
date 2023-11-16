import { Prisma, PrismaClient } from "@prisma/client";
import { Immutable } from "immer";
import { Session } from "next-auth";

type GlobalContext = {
  prisma: PrismaClient;
  session: Session | null;
};

type OptionalAuthContext = {
  journal: Roles<number>;
  post: Roles<number>;
  metric: Roles<string>;
};
type Roles<T> = {
  read: boolean;
  write: boolean;
  id: T;
};

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
