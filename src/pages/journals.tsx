import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { FC } from "react";
import { UnscopedLayout } from "~/components/Layout";
import {
  Cards,
  FullPage,
  Header,
  MainSection,
  Title,
} from "~/components/theme";
import { SafeLink } from "~/lib/urls";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerAuthSession(context);
  return {
    props: {
      myJournals: await db.journal.findMany({
        where: { owner: session?.user },
      }),
      followedJournals: await db.journal.findMany({
        where: {
          subscriptions: {
            some: {
              user: session?.user,
            },
          },
        },
      }),
    },
  };
};

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  return (
    <UnscopedLayout>
      <FullPage>
        <Header>
          <Title>My Journals</Title>
        </Header>
        <MainSection>
          <div className="grid-cell-90">
            {props.myJournals.map((j) => (
              <Cards.PaddedCard
                key={j.id}
                actions={[
                  {
                    page: "viewJournal",
                    journalId: j.id,
                    title: "View Journal",
                  },
                ]}
              >
                {j.description}
              </Cards.PaddedCard>
            ))}
          </div>
        </MainSection>
      </FullPage>
    </UnscopedLayout>
  );
};

export default Page;
