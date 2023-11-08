import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { trpcMutation } from "~/model/Authorization";

export const postsRouter = createTRPCRouter({
  edit: trpcMutation(
    z.object({
      postId: z.number(),
      firstLine: z.string().or(z.null()),
      postJson: z.custom<DeltaStatic>().or(z.null()),
      values: z.record(z.number().or(z.null())),
    }),
    (auth, input) =>
      auth.postWithWritePermissions(input.postId, async (model) => {
        await model.edit(input);
        return { success: true };
      }),
  ),

  create: trpcMutation(
    z.object({ themeId: z.number(), date: Zoneless.zod }),
    (auth, input) =>
      auth.themeWithWritePermissions(input.themeId, async (model) => {
        return {
          newPostId: (await model.newPost(input.date)).id,
        };
      }),
  ),
});
