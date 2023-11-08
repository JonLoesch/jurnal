import { Session } from "next-auth";
import { AuthorizationError } from "./AuthorizationError";
import { Prisma, PrismaClient } from "@prisma/client";
import { ThemeModel, ThemeModelWithWritePermissions } from "./ThemeModel";
import { AuthorizedContext } from "./AuthorizedContext";
import { GetServerSideProps } from "next";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { MetricModel } from "./MetricModel";
import { protectedProcedure } from "~/server/api/trpc";
import { EntryModel, EntryModelWithWritePermissions } from "./EntryModel";

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

function checkThemeAccess(
  session: Session | null,
  theme:
    | Prisma.ThemeGetPayload<{
        select: {
          isPublic: true;
          id: true;
          reader: true;
          owner: true;
        };
      }>
    | null
    | undefined,
): AuthorizedContext<"theme">["theme"] {
  if (theme == null) {
    throw new AuthorizationError();
  }
  const write = theme.owner.email === session?.user.email;
  const read =
    write ||
    theme.reader.some((r) => r.email === session?.user.email) ||
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
  async function fromThemeId(themeid: number) {
    return checkThemeAccess(
      session,
      await prisma.theme.findUnique({
        where: { id: themeid },
        include: {
          reader: true,
          owner: true,
        },
      }),
    );
  }

  async function fromPostId(postid: number) {
    return checkThemeAccess(
      session,
      (
        await db.entry.findUnique({
          where: { id: postid },
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
  }

  return {
    theme<Props>(
      themeid: number,
      getProps: (model: ThemeModel) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const theme = await fromThemeId(themeid);
        return {
          _auth: {
            theme,
          },
          ...(await getProps(
            new ThemeModel({
              prisma,
              session,
              theme,
            }),
          )),
        };
      });
    },
    themeWithWritePermissions<Props>(
      themeid: number,
      getProps: (model: ThemeModelWithWritePermissions) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const theme = await fromThemeId(themeid);
        if (!theme.write) {
          throw new AuthorizationError();
        }
        return {
          _auth: {
            theme,
          },
          ...(await getProps(
            new ThemeModelWithWritePermissions({
              prisma,
              session,
              theme,
            }),
          )),
        };
      });
    },
    post<Props>(
      postid: number,
      getProps: (model: EntryModel) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const theme = await fromPostId(postid);
        return {
          _auth: {
            theme,
          },
          ...(await getProps(
            new EntryModel(
              {
                prisma,
                session,
                theme,
              },
              postid,
            ),
          )),
        };
      });
    },
    postWithWritePermissions<Props>(
      postid: number,
      getProps: (model: EntryModelWithWritePermissions) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const theme = await fromPostId(postid);
        if (!theme.write) {
          throw new AuthorizationError();
        }
        return {
          _auth: {
            theme,
          },
          ...(await getProps(
            new EntryModelWithWritePermissions(
              {
                prisma,
                session,
                theme,
              },
              postid,
            ),
          )),
        };
      });
    },

    metric<Props>(
      metrickey: string,
      getProps: (model: MetricModel) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const theme = checkThemeAccess(
          session,
          (
            await db.metric.findUnique({
              where: { key: metrickey },
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
        return {
          _auth: {
            theme,
          },
          ...(await getProps(
            new MetricModel(
              {
                prisma,
                session,
                theme,
              },
              metrickey,
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
