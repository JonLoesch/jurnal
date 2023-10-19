import { Prisma, PrismaClient } from "@prisma/client";
import { GetServerSideProps, GetServerSidePropsResult } from "next";
import { Session, User } from "next-auth";

type AuthorizedRoles = (
  | {
      read: boolean;
      write: boolean;
      themeid: number;
    }
    | {
      read: false;
      write: false;
    }) & {
      userId?: string;
    };

function checkThemeAccess(
  session: Session | null,
  theme?: Prisma.ThemeGetPayload<{
    select: {
      isPublic: true,
      id: true,
      reader: true;
      owner: true;
    };
  }> | null,
): AuthorizedRoles {
  if (theme == null) {
    return {
      read: false,
      write: false,
    };
  }
  const write = theme.owner.email === session?.user.email;
  const read =
    write ||
    theme.reader.some((r) => r.email === session?.user.email) ||
    theme.isPublic;

  return { read, write, themeid: theme.id, userId: session?.user.id };
}

const redirectToLogin: GetServerSidePropsResult<unknown> = {
  redirect: {
    destination: "/api/auth/signin?callbackUrl",
    permanent: false,
  },
};

export const authorize = {
  async theme<Where extends Prisma.ThemeWhereUniqueInput>(
    db: PrismaClient,
    session: Promise<Session | null> | Session,
    where: Where,
  ) {
    const theme = await db.theme.findUnique({
      where,
      include: {
        reader: true,
        owner: true,
      },
    });
    return checkThemeAccess(await session, theme);
  },
  async post<Where extends Prisma.EntryWhereUniqueInput>(
    db: PrismaClient,
    session: Promise<Session | null> | Session,
    where: Where,
  ): Promise<AuthorizedRoles> {
    return checkThemeAccess(
      await session,
      (
        await db.entry.findUnique({
          where,
          include: {
            theme: {
              include: {
                reader: true,
                owner: true,
              },
            },
          },
        })
      )?.theme,
    );
  },
  async metric<Where extends Prisma.MetricWhereUniqueInput>(
    db: PrismaClient,
    session: Promise<Session | null> | Session,
    where: Where,
  ): Promise<AuthorizedRoles> {
    return checkThemeAccess(
      await session,
      (
        await db.metric.findUnique({
          where,
          include: {
            theme: {
              select: {
                id: true,
                isPublic: true,
                reader: true,
                owner: true,
              },
            },
          },
        })
      )?.theme,
    );
  },
  redirectToLogin,
};
