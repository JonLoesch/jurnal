import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { authorize } from "~/lib/authorize";
import { TRPCError } from "@trpc/server";

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
);

export const postsRouter = createTRPCRouter({
  edit: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        firstLine: z.string().optional(),
        postJson: z.any(),
        values: z.record(z.number().or(z.null())),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(await authorize.post(ctx.db, ctx.session, { id: input.postId })).write
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      await ctx.db.$transaction(async (db) => {
        for (const [key, value] of Object.entries(input.values)) {
          if (value === null) {
            await db.value.deleteMany({
              where: {
                // entryId_metricKey: {
                entryId: input.postId,
                metricKey: key,
                // },
              },
            });
          } else {
            await db.value.upsert({
              where: {
                entryId_metricKey: {
                  entryId: input.postId,
                  metricKey: key,
                },
              },
              create: { entryId: input.postId, metricKey: key, value },
              update: { value },
            });
          }
        }
        await db.entry.update({
          where: { id: input.postId },
          data: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            postQuill: input.postJson,
            postText: input.firstLine,
          },
        });
      });
    }),
  create: protectedProcedure
    .input(z.object({ themeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (
        !(await authorize.theme(ctx.db, ctx.session, { id: input.themeId })).write
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return (
        await db.entry.create({
          data: {
            themeId: input.themeId,
            date: new Date(),
          },
        })
      ).id;
    }),
});
