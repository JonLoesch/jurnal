import { format } from "date-fns";
import { produce } from "immer";
import {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
  InferGetStaticPropsType,
} from "next";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/router";
import { FC, PropsWithChildren, useState } from "react";
import { z } from "zod";
import { MetricAdjust } from "~/components/MetricAdjust";
import { FullPage, MainSection, Title } from "~/components/theme";
import { pageMetadata } from "~/lib/pageMetadata";
import { db } from "~/server/db";

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const postId = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .parse(context.query.postid);
  return {
    props: {
      post: await db.entry.findUniqueOrThrow({
        where: {
          id: postId,
        },
      }),
      values: await db.metric.findMany({
        include: {
          values: {
            where: {
              entryId: postId,
            },
          },
        },
      }),
    },
  };
}

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  const [values, setValues] = useState(() =>
    props.values.map(({ values, ...rest }) => ({
      value: values[0]?.value,
      ...rest,
    })),
  );
  function setValue(key: string, value: number | undefined) {
    setValues((vs) => vs.map((v) => (v.key !== key ? v : { ...v, value })));
  }
  return (
    <FullPage>
      <Title>{format(props.post.date, "MMMM d")}</Title>
      <MainSection>
        {props.post.postText}
        {values.map((v) => (
          <MetricAdjust
            key={v.key}
            metricKey={v.key}
            name={v.name}
            value={v.value}
            onChange={(newValue) => setValue(v.key, newValue)}
          />
        ))}
      </MainSection>
    </FullPage>
  );
};

export const LinkToEditPost: FC<PropsWithChildren<{ postid: number }>> = (
  props,
) => {
  const session = useSession();

  if (!session.data?.user.isPoster) {
    return props.children;
  } else {
    return (
      <Link
        href={{
          pathname: "/posts/edit/[postid]",
          query: { postid: props.postid },
        }}
      >
        {props.children}
      </Link>
    );
  }
};

export default Page;
