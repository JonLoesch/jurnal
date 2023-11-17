import { format } from "date-fns";
import { InferGetServerSidePropsType } from "next";
import {
  FC,
  PropsWithChildren,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { DeltaOperation, type DeltaStatic } from "quill";
import { Zoneless } from "~/lib/ZonelessDate";
import { JournalScopeLayout } from "~/components/Layout";
import { ReactJsonDebugView, WYSIWYG } from "~/components/dynamic";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import { getQuillData } from "~/lib/getQuillData";
import { SafeLink, fromUrl } from "~/lib/urls";
import { cl } from "~/lib/cl";
import { withAuth } from "~/model/Authorization";
import { PostModel } from "~/model/PostModel";
import { GenericMetricAdjust } from "~/components/metrics";

export const getServerSideProps = withAuth(fromUrl.postId, (auth, params) =>
  auth.post(params.postId, async (context) => {
    const model = new PostModel(context);
    const post = await model.obj({});
    const date = post.date;
    const next = await model.next(post);
    const prev = await model.prev(post);
    return {
      post: { ...post, date: Zoneless.fromDate(date) },
      next,
      prev,
      metricValues: await model.metricValues(),
    };
  }),
);

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  const [dirty, setDirty] = useState(false);
  // const [values, setValues] = useState(v);
  // useEffect(() => setValues(v), [v]);
  // function setValue(id: string, value: number | null) {
  //   setValues((vs) => vs.map((v) => (v.id !== id ? v : { ...v, value })));
  //   setDirty(true);
  // }
  const editorRef = useRef<UnprivilegedEditor>(null);
  const [getPostJson, setPostJson] = useState<
    () => {
      full: DeltaStatic | null;
      firstLine: string | null;
    }
  >(() => () => ({
    full: props.post.quillData,
    firstLine: props.post.text,
  }));

  const editPost = api.posts.edit.useMutation();

  return (
    <JournalScopeLayout journalId={props._auth.journal.id}>
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
                      postId: props.prev.id,
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
                      postId: props.next.id,
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
          {/* <StackedForm.Main
            onSubmit={() => {
              const postJson = getQuillData(editorRef);
              void editPost
                .mutateAsync({
                  postId: props.post.id,
                  postJson: postJson.full,
                  firstLine: postJson.firstLine,
                  values: Object.fromEntries(
                    values.map((v) => [v.id, v.value]),
                  ),
                })
                .then(() => setDirty(false));
            }}
          > */}
          <StackedForm.Section
            title="Journal"
            description="How did your day go?"
          >
            <StackedForm.SectionItem>
              <div key={props.post.id}>
                <WYSIWYG
                  editorRef={editorRef}
                  editable={props._auth.journal.write}
                  defaultValue={props.post.quillData}
                  onChange={() => {
                    setDirty(true);
                  }}
                />
              </div>
            </StackedForm.SectionItem>
            {props.metricValues.map((mv) => (
              <StackedForm.SectionItem key={mv.id}>
                <GenericMetricAdjust {...mv} metricId={mv.id} postId={props.post.id}/>
              </StackedForm.SectionItem>
            ))}
          </StackedForm.Section>
          <StackedForm.ButtonPanel>
            <StackedForm.SubmitButton disabled={!dirty} label="Save">
              {editPost.isLoading && <CursorArrowRaysIcon className="w-8" />}
              {editPost.isSuccess && <CheckIcon className="w-8" />}
            </StackedForm.SubmitButton>
          </StackedForm.ButtonPanel>
          {/* </StackedForm.Main> */}
        </MainSection>
      </FullPage>
    </JournalScopeLayout>
  );
};

export default Page;
