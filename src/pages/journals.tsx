import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { FC } from "react";
import { StackedForm } from "~/components/theme";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerAuthSession(context);
  return {
    props: {
      myJournals: await db.theme.findMany({
        where: { owner: session?.user },
      }),
      followedJournals: 
        await db.theme.findMany({
            where: {
                themeSubscription: {
                    some: {
                        user: session?.user,
                    }
                }
            }
        })
    },
  };
};

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {};

export default Page;
