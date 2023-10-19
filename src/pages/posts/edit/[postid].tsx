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
import { FC, PropsWithChildren, useRef, useState } from "react";
import { isDirty, z } from "zod";
import { MetricAdjust, MetricBadge } from "~/components/MetricAdjust";
import { FullPage, MainSection, StackedForm, Title } from "~/components/theme";
import { db } from "~/server/db";
import { api } from "~/utils/api";
import { CheckIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { type DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { authorize } from "~/lib/authorize";
import { getServerAuthSession } from "~/server/auth";
import { Layout } from "~/components/Layout";
import { WYSIWYG } from "~/components/dynamic";


export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const postId = z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .parse(context.query.postid);
  const auth = await authorize.post(db, getServerAuthSession(context), {
    id: postId,
  });
  const { date, ...post } = await db.entry.findUniqueOrThrow({
    where: {
      id: postId,
    },
  });

  if (!auth.read) {
    return authorize.redirectToLogin;
  }
  return {
    props: {
      auth,
      post: { ...post, date: Zoneless.fromDate(date) },
      values: await db.metric.findMany({
        orderBy: {
          sortOrder: "asc",
        },
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
};

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
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
  const postJson: DeltaStatic | undefined = props.post.postQuill as any;
  const [getPostJson, setPostJson] = useState<
    () => {
      full: DeltaStatic | undefined;
      firstLine: string | undefined;
    }
  >(() => () => ({ full: postJson, firstLine: undefined }));

  const editPost = api.posts.edit.useMutation();

  return (
    <Layout themeid={props.auth.themeid}>
      <FullPage>
        <Title>{format(Zoneless.toDate(props.post.date), "EEEE MMMM d")}</Title>
        <MainSection>
          <StackedForm.Main
            onSubmit={() => {
              const postJson = getPostJson();
              void editPost
                .mutateAsync({
                  postId: props.post.id,
                  postJson: postJson.full,
                  firstLine: postJson.firstLine,
                  values: Object.fromEntries(
                    values.map((v) => [v.key, v.value]),
                  ),
                })
                .then(() => setDirty(false));
            }}
          >
            <StackedForm.Section
              title="Journal"
              description="How did your day go?"
            >
              <StackedForm.SectionItem>
                <WYSIWYG
                  editable={props.auth.write}
                  defaultValue={postJson}
                  onChange={(fetch) => {
                    setPostJson(() => fetch);
                    setDirty(true);
                  }}
                />
              </StackedForm.SectionItem>
              {props.auth.write &&
                values.map((v) => (
                  <StackedForm.SectionItem key={v.key}>
                    <MetricAdjust
                      metricKey={v.key}
                      name={v.name}
                      value={v.value}
                      onChange={(newValue) => setValue(v.key, newValue)}
                    />
                  </StackedForm.SectionItem>
                ))}
              {!props.auth.write && (
                <StackedForm.SectionItem>
                  {values.map((v) =>
                    v.value === null ? null : (
                      <MetricBadge
                        key={v.key}
                        metricKey={v.key}
                        name={v.name}
                        value={v.value}
                        // onChange={(newValue) => setValue(v.key, newValue)}
                      />
                    ),
                  )}
                </StackedForm.SectionItem>
              )}
            </StackedForm.Section>
            <StackedForm.ButtonPanel>
              <StackedForm.SubmitButton disabled={!dirty} label="Save">
                {editPost.isLoading && <CursorArrowRaysIcon className="w-8" />}
                {editPost.isSuccess && <CheckIcon className="w-8" />}
              </StackedForm.SubmitButton>
            </StackedForm.ButtonPanel>
          </StackedForm.Main>
        </MainSection>
      </FullPage>
    </Layout>
  );
};

export default Page;
