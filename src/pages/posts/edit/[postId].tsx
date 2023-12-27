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
  Groups,
  Header,
  MainSection,
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
import { GenericMetric, GenericMetricAdjust } from "~/components/metrics";
import { useApiConditions, useCondition } from "~/lib/watcher";

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
      <FullPage key={props.post.id}>
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
          <Groups.GroupSection>
            {Object.values(props.metricValues).map(
              (metricGroup) =>
                (props._auth.post.write ||
                  metricGroup.metrics.some((x) => x.value !== null)) && (
                  <Groups.Group
                    title={metricGroup.name}
                    description={metricGroup.description}
                    key={metricGroup.id}
                  >
                    {metricGroup.metrics.map(
                      (metric) =>
                        (props._auth.post.write || metric.value !== null) && (
                          <Groups.Item
                            title={metric.name}
                            description={metric.description}
                            key={metric.id}
                          >
                            <GenericMetric
                              edittable={props._auth.post.write}
                              {...metric}
                              metricId={metric.id}
                              postId={props.post.id}
                            />
                          </Groups.Item>
                        ),
                    )}
                  </Groups.Group>
                ),
            )}
          </Groups.GroupSection>
        </MainSection>
      </FullPage>
    </JournalScopeLayout>
  );
};

export default Page;
