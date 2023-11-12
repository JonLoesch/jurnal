import { Prisma, PrismaClient } from "@prisma/client";
import { Session } from "next-auth";

type GlobalContext = {
  prisma: PrismaClient;
  session: Session | null;
};

type OptionalContext = {
  journal: Roles<{ id: number }>;
};

export type AuthorizedContext<Key extends keyof OptionalContext> =
  GlobalContext & Pick<OptionalContext, Key>;

type Roles<Extra extends Record<string, unknown>> = ({
  read: boolean;
  write: boolean;
  //   themeid: number;
} & Extra) & {
  // userId?: string;
};
