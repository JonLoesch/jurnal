import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";


const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);


export const postsRouter = createTRPCRouter({
  edit: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        postText: z.string().min(1).or(z.null()),
        postJson: z.any(),
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: { postText: input.postText, postQuill: input.postJson},
        });
      });
    }),
  create: protectedProcedure.mutation(async ({ ctx }) => {
    return (
      await db.entry.create({
        data: {
          date: new Date(),
        },
      })
    ).id;
  }),
});
