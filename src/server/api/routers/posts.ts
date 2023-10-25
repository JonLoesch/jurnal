import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { authorize } from "~/lib/authorize";
import { TRPCError } from "@trpc/server";
import { DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";

export const postsRouter = createTRPCRouter({
  edit: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        firstLine: z.string().or(z.null()),
        postJson: z.custom<DeltaStatic>().or(z.null()),
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
            postQuill: input.postJson ?? undefined,
            postText: input.firstLine,
          },
        });
      });
    }),
  create: protectedProcedure
    .input(z.object({ themeId: z.number(), date: Zoneless.zod }))
    .mutation(async ({ ctx, input }) => {
      if (
        !(await authorize.theme(ctx.db, ctx.session, { id: input.themeId }))
          .write
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      return (
        await db.entry.create({
          data: {
            themeId: input.themeId,
            date: Zoneless.toDate(input.date),
          },
        })
      ).id;
    }),
});
