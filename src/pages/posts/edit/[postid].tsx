import { format } from "date-fns";
import { produce } from "immer";
import {
  GetServerSidePropsContext,
  InferGetServerSidePropsType,
  InferGetStaticPropsType,
} from "next";
import {
  FC,
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isDirty, z } from "zod";
import { MetricAdjust, MetricBadge } from "~/components/MetricAdjust";
import {
  FullPage,
  Header,
  MainSection,
  StackedForm,
  Subtitle,
  Title,
} from "~/components/theme";
import { db } from "~/server/db";
import { api } from "~/utils/api";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import { type DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { authorize } from "~/lib/authorize";
import { getServerAuthSession } from "~/server/auth";
import { JournalScopeLayout } from "~/components/Layout";
import { WYSIWYG } from "~/components/dynamic";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import { getQuillData } from "~/lib/getQuillData";
import { OptionalLocator, SafeLink } from "~/lib/urls";
import { cl } from "~/lib/cl";

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
  const next = await db.entry.findFirst({
    where: {
      OR: [
        {
          date: {
            gt: date,
          },
        },
        {
          date: { gte: date },
          id: { gt: post.id },
        },
      ],
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const prev = await db.entry.findFirst({
    where: {
      OR: [
        {
          date: {
            lt: date,
          },
        },
        {
          date: { lte: date },
          id: { lt: post.id },
        },
      ],
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
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
      prev,
      next,
    },
  };
};

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  const [dirty, setDirty] = useState(false);
  const v = useMemo(
    () =>
      props.values.map(({ values, ...rest }) => ({
        value: values[0]?.value ?? null,
        ...rest,
      })),
    [props.values],
  );
  const [values, setValues] = useState(v);
  useEffect(() => setValues(v), [v]);
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
        <Header>
          <Title>
            {format(Zoneless.toDate(props.post.date), "EEEE MMMM d")}
          </Title>
          <Subtitle>
            <div className="flex flex-row items-center justify-between">
              <SafeLink
                {...(props.prev === null
                  ? { link: "disabled" }
                  : {
                      page: "editPost",
                      postid: props.prev.id,
                    })}
              >
                <div
                  className={cl("whitespace-nowrap", {
                    "text-gray-300": props.prev === null,
                  })}
                >
                  <ChevronLeftIcon className="inline h-10" />
                  Previous
                </div>
              </SafeLink>

              <SafeLink
                {...(props.next === null
                  ? { link: "disabled" }
                  : {
                      page: "editPost",
                      postid: props.next.id,
                    })}
              >
                <div
                  className={cl("whitespace-nowrap", {
                    "text-gray-300": props.next === null,
                  })}
                >
                  Next
                  <ChevronRightIcon className="inline h-10" />
                </div>
              </SafeLink>
            </div>
          </Subtitle>
        </Header>
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
                <div key={props.post.id}>
                  <WYSIWYG
                    editorRef={editorRef}
                    editable={props.auth.write}
                    defaultValue={props.post.postQuill}
                    onChange={() => {
                      setDirty(true);
                    }}
                  />
                </div>
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
