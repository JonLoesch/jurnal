import { Session } from "next-auth";
import { AuthorizationError } from "./AuthorizationError";
import { Prisma, PrismaClient } from "@prisma/client";
import { JournalModel, JournalModelWithWritePermissions } from "./JournalModel";
import { AuthorizedContextKey, AuthorizedContext } from "./AuthorizedContext";
import { GetServerSideProps } from "next";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { z } from "zod";
import { MetricModel } from "./MetricModel";
import { protectedProcedure } from "~/server/api/trpc";
import { PostModel, PostModelWithWritePermissions } from "./PostModel";
import { TRPCError } from "@trpc/server";

function checkJournalAccess(
  session: Session | null,
  journal: Prisma.JournalGetPayload<{
    select: {
      isPublic: true;
      id: true;
      readers: true;
      owner: true;
    };
  }>,
): AuthorizedContext<["journal"]>["_auth"]["journal"] {
  const write = journal.owner.email === session?.user.email;
  const read =
    write ||
    journal.readers.some((r) => r.email === session?.user.email) ||
    journal.isPublic;

  if (!read) {
    throw new AuthorizationError();
  }

  return {
    read,
    write,
    id: journal.id,
    //, userId: session?.user.id
  };
}

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

export const Authorization = (
  prisma: PrismaClient,
  session: Session | null,
) => {
  async function fromJournalId(
    journalId: number,
  ): Promise<AuthorizedContext<["journal"]>["_auth"]> {
    const journalData = await prisma.journal.findUnique({
      where: { id: journalId },
      include: {
        readers: true,
        owner: true,
      },
    });
    if (journalData == null) {
      throw new AuthorizationError();
    }
    return { journal: checkJournalAccess(session, journalData) };
  }

  async function fromPostId(
    postId: number,
  ): Promise<AuthorizedContext<["journal", "post"]>["_auth"]> {
    const postData = await db.post.findUnique({
      where: { id: postId },
      include: {
        journal: {
          include: {
            readers: true,
            owner: true,
          },
        },
      },
    });
    if (postData == null) {
      throw new AuthorizationError();
    }
    const journal = checkJournalAccess(session, postData.journal);
    return {
      journal: journal,
      post: {
        id: postData.id,
        read: journal.read, // There are no separate post R/W access controls, they are inherited from the journal (for now)
        write: journal.write, // There are no separate post R/W access controls, they are inherited from the journal (for now)
      },
    };
  }

  async function fromMetricId(
    metricId: string,
  ): Promise<AuthorizedContext<["journal", "metric"]>["_auth"]> {
    const metricData = await db.metric.findUnique({
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
    });
    if (metricData == null) {
      throw new AuthorizationError();
    }
    const journal = checkJournalAccess(session, metricData.journal);
    return {
      journal,
      metric: {
        id: metricData.id,
        read: journal.read, // There are no separate metric R/W access controls, they are inherited from the journal (for now)
        write: journal.write, // There are no separate metric R/W access controls, they are inherited from the journal (for now)
        metricSchema: metricData.metricSchema,
      },
    };
  }

  async function includeAuth<
    Props extends Record<string, unknown>,
    Key extends AuthorizedContextKey,
  >(
    getProps: (context: AuthorizedContext<Key>) => Promise<Props>,
    context: AuthorizedContext<Key>,
  ) {
    return {
      _auth: context._auth,
      ...(await getProps(context)),
    };
  }

  return {
    journal<Props extends Record<string, unknown>>(
      journalId: number,
      getProps: (context: AuthorizedContext<["journal"]>) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const _auth = await fromJournalId(journalId);
        return includeAuth(getProps, { _auth, prisma, session });
      });
    },

    post<Props extends Record<string, unknown>>(
      postId: number,
      getProps: (
        context: AuthorizedContext<["journal", "post"]>,
      ) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const _auth = await fromPostId(postId);
        return includeAuth(getProps, { _auth, prisma, session });
      });
    },

    metric<Props extends Record<string, unknown>>(
      metricId: string,
      getProps: (
        model: AuthorizedContext<["journal", "metric"]>,
      ) => Promise<Props>,
    ) {
      return wrapResult(async () => {
        const _auth = await fromMetricId(metricId);
        return includeAuth(getProps, { _auth, prisma, session });
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

export function trpcMutation<ParamsZod extends z.AnyZodObject, Props>(
  validator: ParamsZod,
  fn: (
    authorization: ReturnType<typeof Authorization>,
    params: z.infer<ParamsZod>,
  ) => Promise<MaybeAuthError<Props>>,
) {
  return protectedProcedure
    .input(validator)
    .mutation(async ({ ctx, input }) => {
      const result = await fn(
        Authorization(ctx.db, ctx.session),
        input as z.infer<ParamsZod>,
      );
      if (result.error === "authorization_error") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to access this data",
        });
      } else {
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
