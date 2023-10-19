import { format } from "date-fns";
import { produce } from "immer";
import {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
  InferGetStaticPropsType,
} from "next";
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
import { JournalScopeLayout } from "~/components/Layout";
import { WYSIWYG } from "~/components/dynamic";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import { getQuillData } from "~/lib/getQuillData";

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
  const editorRef = useRef<UnprivilegedEditor>(null);
  const [getPostJson, setPostJson] = useState<
    () => {
      full: DeltaStatic | null;
      firstLine: string | null;
    }
  >(() => () => ({
    full: props.post.postQuill,
    firstLine: props.post.postText,
  }));

  const editPost = api.posts.edit.useMutation();

  return (
    <JournalScopeLayout themeid={props.auth.themeid}>
      <FullPage>
        <Title>{format(Zoneless.toDate(props.post.date), "EEEE MMMM d")}</Title>
        <MainSection>
          <StackedForm.Main
            onSubmit={() => {
              const postJson = getQuillData(editorRef);
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
                  editorRef={editorRef}
                  editable={props.auth.write}
                  defaultValue={props.post.postQuill}
                  onChange={() => {
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
    </JournalScopeLayout>
  );
};

export default Page;
