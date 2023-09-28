import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";

export const postsRouter = createTRPCRouter({
  edit: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        postText: z.string().min(1).or(z.null()),
        values: z.record(z.number().or(z.null())),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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
          data: { postText: input.postText },
        });
      });
    }),
    create: protectedProcedure.mutation(async({ctx}) => {
        return (await db.entry.create({
            data: {
                date: new Date(),
            }
        })).id;
    }),
});
