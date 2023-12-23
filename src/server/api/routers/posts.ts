import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { trpcMutation } from "~/model/Authorization";
import { JournalModelWithWritePermissions } from "~/model/JournalModel";
import { PostModelWithWritePermissions } from "~/model/PostModel";
import { metricSchemas } from "~/lib/metricSchemas";
import { MetricModeWithWritePermissions } from "~/model/MetricModel";

export const postsRouter = createTRPCRouter({
  edit: trpcMutation(
    z.object({
      postId: z.number(),
      firstLine: z.string().or(z.null()),
      postJson: z.custom<DeltaStatic>().or(z.null()),
    }),
    (auth, input) =>
      auth.post(input.postId, async (context) => {
        await new PostModelWithWritePermissions(context).edit(input);
        return { success: true };
      }),
  ),

  editValue: trpcMutation(
    z.object({
      postId: z.number(),
      metricId: z.string(),
      change: metricSchemas.validateGenericMetricChange.nullable(),
    }),
    (auth, input) => 
      auth.metric(input.metricId, async context => {
        return await new MetricModeWithWritePermissions(context).editValue(input);
      })
    
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
