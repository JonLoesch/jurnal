import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { authorize } from "~/lib/authorize";
import { TRPCError } from "@trpc/server";
import { DeltaStatic } from "quill";

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
);

export const journalsRouter = createTRPCRouter({
  edit: protectedProcedure
    .input(
      z.object({
        themeId: z.number(),
        description: z.string().or(z.null()),
        quill: z.custom<DeltaStatic>().or(z.null()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (
        !(await authorize.theme(ctx.db, ctx.session, { id: input.themeId })).write
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
        await db.theme.update({
          where: { id: input.themeId },
          data: {
            quill: input.quill ?? undefined,
            description: input.description ?? undefined,
          },
        });
    }),
});
