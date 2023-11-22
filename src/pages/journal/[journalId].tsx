import { CheckIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Quill, { DeltaStatic } from "quill";
import { FC, useRef, useState } from "react";
import { UnprivilegedEditor } from "react-quill";
import { JournalScopeLayout } from "~/components/Layout";
import { getQuillData } from "~/lib/getQuillData";
import { WYSIWYG } from "~/components/dynamic";
import {
  FullPage,
  Header,
  MainSection,
  StackedForm,
  Title,
} from "~/components/theme";
import { api } from "~/utils/api";
import { Toast, useToastMessage } from "~/lib/useToastMessage";
import { withAuth } from "~/model/Authorization";
import { fromUrl } from "~/lib/urls";
import { JournalModel } from "~/model/JournalModel";

export const getServerSideProps = withAuth(fromUrl.journalId,
  (auth, params) =>
    auth.journal(params.journalId, async (context) => ({
      journal: await new JournalModel(context).obj({
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
  const editJournal = api.journals.edit.useMutation();
  const editorRef = useRef<Quill>(null);

  const subscribeApi = api.journals.subscribe.useMutation();
  const toast = useToastMessage();

  return (
    <JournalScopeLayout journalId={props._auth.journal.id}>
      <FullPage>
        <Header>
          <Title>{props.journal.name}</Title>
        </Header>
        <MainSection>
          <StackedForm.Main
            onSubmit={() => {
              const quillData = getQuillData(editorRef);
              void editJournal
                .mutateAsync({
                  journalId: props.journal.id,
                  quill: quillData.full,
                  description: quillData.firstLine,
                })
                .then(() => setDirty(false));
            }}
          >
            <StackedForm.Section
              title="Description"
              description="What's this journal all about?"
            >
              <StackedForm.SectionItem>
                <WYSIWYG
                  editorRef={editorRef}
                  editable={props._auth.journal.write}
                  defaultValue={props.journal.quill}
                  onChange={() => {
                    setDirty(true);
                  }}
                />
              </StackedForm.SectionItem>
              <StackedForm.ButtonPanel>
                <StackedForm.SubmitButton disabled={!dirty} label="Save">
                  {editJournal.isLoading && (
                    <CursorArrowRaysIcon className="w-8" />
                  )}
                  {editJournal.isSuccess && <CheckIcon className="w-8" />}
                </StackedForm.SubmitButton>
              </StackedForm.ButtonPanel>
            </StackedForm.Section>
            <StackedForm.Section title="Notifications">
              <StackedForm.Checkbox
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
            </StackedForm.Section>
          </StackedForm.Main>
        </MainSection>
      </FullPage>
      <Toast {...toast} />
    </JournalScopeLayout>
  );
};

export default Page;
