import { format } from "date-fns";
import {
  InferGetServerSidePropsType,
} from "next";
import {
  FC,
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MetricAdjust, MetricBadge } from "~/components/MetricAdjust";
import {
  FullPage,
  Header,
  MainSection,
  StackedForm,
  Subtitle,
  Title,
} from "~/components/theme";
import { api } from "~/utils/api";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CursorArrowRaysIcon,
} from "@heroicons/react/24/outline";
import { type DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { JournalScopeLayout } from "~/components/Layout";
import { WYSIWYG } from "~/components/dynamic";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import { getQuillData } from "~/lib/getQuillData";
import { SafeLink, fromUrl } from "~/lib/urls";
import { cl } from "~/lib/cl";
import { withAuth } from "~/model/Authorization";

export const getServerSideProps = withAuth(fromUrl.postid, (auth, params) =>
  auth.post(params.postid, async (model) => {
    const post = await model.obj({});
    const date = post.date;
    const next = await model.next(post);
    const prev = await model.prev(post);
    return {
      post: {...post, date: Zoneless.fromDate(date)},
      next,
      prev,
      values: await model.values(),
    };
  }),
);

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
    <JournalScopeLayout themeid={props._auth.theme.id}>
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
                    editable={props._auth.theme.write}
                    defaultValue={props.post.postQuill}
                    onChange={() => {
                      setDirty(true);
                    }}
                  />
                </div>
              </StackedForm.SectionItem>
              {props._auth.theme.write &&
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
              {!props._auth.theme.write && (
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
