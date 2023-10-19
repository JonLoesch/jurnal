import { Prisma } from "@prisma/client";
import { Text } from "@react-email/text";
import { startOfDay, subDays } from "date-fns";
import NewPost from "~/emails/newpost";
import { cronjob } from "~/lib/cronjob";
import { sendEmail } from "~/lib/email";
import { db } from "~/server/db";

export default cronjob(async () => {
  for (const post of await db.entry.findMany({
    where: {
      date: startOfDay(subDays(new Date(), 1)),
    },
    include: {
      theme: {
        include: {
          themeSubscription: {
            include: {
              user: true,
            },
          },
          owner: true,
        },
      },
    },
  })) {
    const react = <NewPost post={post} />;
    for (const sub of post.theme.themeSubscription) {
      if (sub.user.email !== null) {
        await sendEmail({
          to: sub.user.email,
          subject: "New Jurnal Update",
          react,
        });
      }
    }
  }
  return {
    cronSuccess: true,
  };
});
