import { Session } from "next-auth";
import { AuthorizationError } from "./AuthorizationError";
import { Prisma, PrismaClient } from "@prisma/client";
import { JournalModel, ThemeModelWithWritePermissions } from "./JournalModel";
import { AuthorizedContext } from "./AuthorizedContext";
import { GetServerSideProps } from "next";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { MetricModel } from "./MetricModel";
import { protectedProcedure } from "~/server/api/trpc";
import { PostModel, EntryModelWithWritePermissions } from "./PostModel";
import { TRPCError } from "@trpc/server";

type MaybeAuthError<T> =
  | {
      error: null;
      data: T;
    }
  | {
      error: "authorization_error";
      details: AuthorizationError;
    };

async function wrapResult<T>(fn: () => Promise<T>): Promise<MaybeAuthError<T>> {
  try {
    return {
      error: null,
      data: await fn(),
    };
  } catch (details) {
    if (!(details instanceof AuthorizationError)) throw details;
    return {
      error: "authorization_error",
      details,
    };
  }
}

function checkJournalAccess(
  session: Session | null,
  theme:
    | Prisma.JournalGetPayload<{
        select: {
          isPublic: true;
          id: true;
          readers: true;
          owner: true;
        };
      }>
    | null
    | undefined,
): AuthorizedContext<"journal">["journal"] {
  if (theme == null) {
    throw new AuthorizationError();
  }
  const write = theme.owner.email === session?.user.email;
  const read =
    write ||
    theme.readers.some((r) => r.email === session?.user.email) ||
    theme.isPublic;

  if (!read) {
    throw new AuthorizationError();
  }

  return {
    read,
    write,
    id: theme.id,
    //, userId: session?.user.id
  };
}

export const Authorization = (
  prisma: PrismaClient,
  session: Session | null,
) => {
  async function fromJournalId(journalId: number) {
    return checkJournalAccess(
      session,
      await prisma.journal.findUnique({
        where: { id: journalId },
        include: {
          readers: true,
          owner: true,
        },
      }),
    );
  }

  async function fromPostId(postId: number) {
    return checkJournalAccess(
      session,
      (
        await db.post.findUnique({
          where: { id: postId },
          include: {
            journal: {
              include: {
                readers: true,
                owner: true,
              },
            },
          },
        })
      )?.journal,
    );
  }

  return {
    journal<Props extends Record<string, unknown>>(
      themeid: number,
      getProps: (model: JournalModel) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const journal = await fromJournalId(themeid);
        return {
          _auth: {
            journal,
          },
          ...(await getProps(
            new JournalModel({
              prisma,
              session,
              journal,
            }),
          )),
        };
      });
    },
    journalWithWritePermissions<Props extends Record<string, unknown>>(
      themeid: number,
      getProps: (model: ThemeModelWithWritePermissions) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const journal = await fromJournalId(themeid);
        if (!journal.write) {
          throw new AuthorizationError();
        }
        return {
          _auth: {
            journal,
          },
          ...(await getProps(
            new ThemeModelWithWritePermissions({
              prisma,
              session,
              journal,
            }),
          )),
        };
      });
    },
    post<Props extends Record<string, unknown>>(
      postid: number,
      getProps: (model: PostModel) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const journal = await fromPostId(postid);
        return {
          _auth: {
            journal,
          },
          ...(await getProps(
            new PostModel(
              {
                prisma,
                session,
                journal,
              },
              postid,
            ),
          )),
        };
      });
    },
    postWithWritePermissions<Props extends Record<string, unknown>>(
      postid: number,
      getProps: (model: EntryModelWithWritePermissions) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const journal = await fromPostId(postid);
        if (!journal.write) {
          throw new AuthorizationError();
        }
        return {
          _auth: {
            journal,
          },
          ...(await getProps(
            new EntryModelWithWritePermissions(
              {
                prisma,
                session,
                journal,
              },
              postid,
            ),
          )),
        };
      });
    },

    metric<Props extends Record<string, unknown>>(
      metricId: string,
      getProps: (model: MetricModel) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const journal = checkJournalAccess(
          session,
          (
            await db.metric.findUnique({
              where: { id: metricId },
              include: {
                journal: {
                  select: {
                    id: true,
                    isPublic: true,
                    readers: true,
                    owner: true,
                  },
                },
              },
            })
          )?.journal
        );
        return {
          _auth: {
            journal,
          },
          ...(await getProps(
            new MetricModel(
              {
                prisma,
                session,
                journal,
              },
              metricId,
            ),
          )),
        };
      });
    },
    session,
  };
};

export function withAuth<
  ParamsZod extends z.AnyZodObject,
  Props extends Record<string, unknown>,
>(
  validator: ParamsZod,
  fn: (
    authorization: ReturnType<typeof Authorization>,
    params: z.infer<ParamsZod>,
  ) => Promise<MaybeAuthError<Props>>,
): GetServerSideProps<Props, z.infer<ParamsZod>> {
  return async (context) => {
    const params = validator.parse(context.params);
    const session = await getServerAuthSession(context);
    const authorization = Authorization(db, session);
    const result = await fn(authorization, params);
    if (result.error === "authorization_error") {
      return {
        redirect: {
          destination: "/api/auth/signin?callbackUrl",
          permanent: false,
        },
      };
    } else {
      return {
        props: result.data,
      };
    }
  };
}

export function trpcMutation<
  ParamsZod extends z.AnyZodObject,
  Props,
>(
  validator: ParamsZod,
  fn: (
    authorization: ReturnType<typeof Authorization>,
    params: z.infer<ParamsZod>,
  ) => Promise<MaybeAuthError<Props>>,
) {
  return protectedProcedure
    .input(validator.extend({})) // What?  Why does this matter?
    .mutation(async ({ ctx, input }) => {
      const result = await fn(Authorization(ctx.db, ctx.session), input);
      if (result.error === 'authorization_error') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to access this data',
        })
      }
      else {
        return result.data;
      }
    });
}

// export function trpcAuth<TParams extends ProcedureParams, $Output>(): (
//   opts: ResolveOptions<TParams>,
// ) => Promise<$Output> {
//   return async () => {
//     return Promise.resolve(null as any);
//   };
// }

// function themeMutationProcedure<
//   ParamsZod extends z.AnyZodObject,
//   Result extends Record<string, unknown>,
// >(
//   validator: ParamsZod,
//   fn: (authorization: ReturnType<typeof Authorization>, input: z.infer<ParamsZod>) => Promise<Result>,
// ) {
//   return protectedProcedure
//     .input(validator.extend({ themeId: z.number() }))
//     .mutation(({ ctx, input }) => {
//       if (input.themeId == null) {
//         throw new AuthorizationError();
//       }
//       return fn(Authorization(ctx.db, ctx.session), input);
//     });
// }
