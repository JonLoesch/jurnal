import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { trpcMutation } from "~/model/Authorization";
import { JournalModelWithWritePermissions } from "~/model/JournalModel";
import { PostModelWithWritePermissions } from "~/model/PostModel";

export const postsRouter = createTRPCRouter({
  edit: trpcMutation(
    z.object({
      postId: z.number(),
      firstLine: z.string().or(z.null()),
      postJson: z.custom<DeltaStatic>().or(z.null()),
      values: z.record(z.number().or(z.null())),
    }),
    (auth, input) =>
      auth.post(input.postId, async (context) => {
        await new PostModelWithWritePermissions(context).edit(input);
        return { success: true };
      }),
  ),

  create: trpcMutation(
    z.object({ journalId: z.number(), date: Zoneless.zod }),
    (auth, input) =>
      auth.journal(input.journalId, async (context) => {
        return {
          newPostId: (await new JournalModelWithWritePermissions(context).newPost(input.date)).id,
        };
      }),
  ),
});
