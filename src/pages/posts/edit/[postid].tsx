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
import { isDirty, z } from "zod";
import { MetricAdjust } from "~/components/MetricAdjust";
import { FullPage, MainSection, StackedForm, Title } from "~/components/theme";
import { db } from "~/server/db";
import dynamic from "next/dynamic";
import { api } from "~/utils/api";
import { CheckIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";

const WYSIWYG = dynamic(
  () => import("~/components/WYSIWYG").then((x) => x.WYSIWYG),
  {
    ssr: false,
  },
);

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
  const [dirty, setDirty] = useState(false);
  const [values, setValues] = useState(() =>
    props.values.map(({ values, ...rest }) => ({
      value: values[0]?.value ?? null,
      ...rest,
    })),
  );
  function setValue(key: string, value: number | null) {
    setValues((vs) => vs.map((v) => (v.key !== key ? v : { ...v, value })));
    setDirty(true);
  }
  const [postText, setPostText] = useState(props.post.postText);

  const editPost = api.posts.edit.useMutation();

  return (
    <FullPage>
      <Title>{format(props.post.date, "MMMM d")}</Title>
      <MainSection>
        <StackedForm.Main
          onSubmit={() => {
            void editPost
              .mutateAsync({
                postId: props.post.id,
                postText,
                values: Object.fromEntries(values.map((v) => [v.key, v.value])),
              })
              .then(() => setDirty(false));
          }}
        >
          <StackedForm.Section
            title="Journal"
            description="How did your day go?"
          >
            <StackedForm.TextArea
              label=""
              metricKey="postText"
              text={postText}
              onChange={(t) => {
                setPostText(t);
                setDirty(true);
              }}
              placeholder=""
            />
            {values.map((v) => (
              <StackedForm.SectionItem key={v.key}>
                <MetricAdjust
                  metricKey={v.key}
                  name={v.name}
                  value={v.value}
                  onChange={(newValue) => setValue(v.key, newValue)}
                />
              </StackedForm.SectionItem>
            ))}
          </StackedForm.Section>
          <StackedForm.ButtonPanel>
            <StackedForm.SubmitButton disabled={!dirty} label="Save">
              {editPost.isLoading && <CursorArrowRaysIcon className='w-8'/>}
              {editPost.isSuccess && <CheckIcon className='w-8'/>}
            </StackedForm.SubmitButton>
          </StackedForm.ButtonPanel>
        </StackedForm.Main>
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
