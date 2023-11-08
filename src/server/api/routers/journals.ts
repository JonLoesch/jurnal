import { z } from "zod";
import { createTRPCRouter } from "../trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { DeltaStatic } from "quill";
import { Authorization, trpcMutation } from "~/model/Authorization";

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
);

export const journalsRouter = createTRPCRouter({
  edit: trpcMutation(z.object({
    description: z.string().or(z.null()),
    quill: z.custom<DeltaStatic>().or(z.null()),
    themeId: z.number(),
  }), (auth, input) => auth.themeWithWritePermissions(input.themeId, async model => {
    await model.editTheme(input.description, input.quill);
    return {success: true};
  })),
  
  subscribe: trpcMutation(z.object({
    subscribe: z.boolean(),
    themeId: z.number(),
  }), (auth, input) => auth.theme(input.themeId, async model => {
    await model.subscribe(input.subscribe)
    return {success: true};
  })),
});
