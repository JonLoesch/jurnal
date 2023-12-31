import { CheckIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Quill, { DeltaStatic } from "quill";
import { FC, useRef, useState } from "react";
import { UnprivilegedEditor } from "react-quill";
import { JournalScopeLayout } from "~/components/Layout";
import { getQuillData } from "~/lib/getQuillData";
import { MetricGroupEditor, WYSIWYG } from "~/components/dynamic";
import {
  Forms,
  FullPage,
  Groups,
  Header,
  MainSection,
  Title,
} from "~/components/theme";
import { api } from "~/utils/api";
import { Toast, useToastMessage } from "~/lib/useToastMessage";
import { withAuth } from "~/model/Authorization";
import { fromUrl } from "~/lib/urls";
import { JournalModel } from "~/model/JournalModel";
import { Prisma } from "@prisma/client";
import { ClientImpl_MetricGroupEditor } from "~/components/MetricGroupEditor";

export const getServerSideProps = withAuth(fromUrl.journalId, (auth, params) =>
  auth.journal(params.journalId, async (context) => ({
    journal: await new JournalModel(context).obj({
      metricGroups: {
        orderBy: { sortOrder: "asc" },
        where: { active: true },
        include: {
          metrics: {
            where: { active: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      subscriptions: {
        where: {
          userId: auth.session?.user.id ?? "no_one",
        },
      },
    }),
  })),
);

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  const [dirty, setDirty] = useState(false);
  const [metricGroups, setMetricGroups] = useState(() =>
    converMetricGroups(props.journal.metricGroups),
  );
  const editJournal = api.journals.edit.useMutation();
  const editorRef = useRef<Quill>(null);

  const subscribeApi = api.journals.subscribe.useMutation();
  const toast = useToastMessage();

  const metadataSaveButton = (
    <Forms.SubmitButton disabled={!dirty} label="Save">
      {editJournal.isLoading && <CursorArrowRaysIcon className="w-8" />}
      {editJournal.isSuccess && <CheckIcon className="w-8" />}
    </Forms.SubmitButton>
  );
  const isMyJournal = props._auth.journal.write;

  return (
    <JournalScopeLayout journalId={props._auth.journal.id}>
      <FullPage>
        <Header>
          <Title>{props.journal.name}</Title>
        </Header>
        <MainSection>
          <Forms.Form
            onSubmit={() => {
              const quillData = getQuillData(editorRef);
              void editJournal
                .mutateAsync({
                  journalId: props.journal.id,
                  quill: quillData.full,
                  description: quillData.firstLine,
                  metricGroups: metricGroups,
                })
                .then(() => setDirty(false));
            }}
          >
            <Groups.GroupSection>
              <Groups.Group
                title="Journal"
                description={
                  isMyJournal ? "Edit metadata about the journal" : undefined
                }
                controls={isMyJournal ? metadataSaveButton : undefined}
              >
                <Groups.Item
                  title="Description"
                  description="What's this journal all about?"
                >
                  <WYSIWYG
                    editorRef={editorRef}
                    editable={isMyJournal}
                    defaultValue={props.journal.quill}
                    onChange={() => {
                      setDirty(true);
                    }}
                  />
                </Groups.Item>
                {isMyJournal && (
                  <Groups.Item
                    title="Template"
                    description="What fields will be available with every post?"
                  >
                    <MetricGroupEditor
                      metricGroups={metricGroups}
                      setMetricGroups={(x) => {
                        setDirty(true);
                        setMetricGroups(x);
                      }}
                    />
                  </Groups.Item>
                )}
                <Groups.Item title="Notifications">
                  <Forms.Checkbox
                    label="Sign up for daily email updates"
                    inputKey="dailyNotifications"
                    defaultChecked={props.journal.subscriptions.length > 0}
                    onChange={(x) => {
                      void subscribeApi
                        .mutateAsync({
                          subscribe: x,
                          themeId: props.journal.id,
                        })
                        .then(() => {
                          toast.newToast(
                            `Successfully ${
                              x ? "subscribed to" : "unsubscribed from"
                            } notifications from this journal`,
                            400000,
                          );
                        });
                    }}
                  />
                </Groups.Item>
              </Groups.Group>
            </Groups.GroupSection>
          </Forms.Form>
        </MainSection>
      </FullPage>
      <Toast {...toast} />
    </JournalScopeLayout>
  );
};

function converMetricGroups(
  metricGroups: Parameters<typeof Page>[0]["journal"]["metricGroups"],
): Parameters<typeof ClientImpl_MetricGroupEditor>[0]["metricGroups"] {
  return metricGroups.map((g) => ({
    operation: "update",
    name: g.name,
    description: g.description,
    id: g.id,
    dndID: `metric_group ${g.id}`,
    metrics: g.metrics.map((m) => ({
      operation: "update",
      name: m.name,
      description: m.description,
      id: m.id,
      schema: m.metricSchema,
      dndID: `metric ${m.id}`,
    })),
  }));
}

export default Page;
