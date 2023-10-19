import { CheckIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { DeltaStatic } from "quill";
import { FC, useRef, useState } from "react";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import { z } from "zod";
import { JournalScopeLayout } from "~/components/Layout";
import { getQuillData } from "~/lib/getQuillData";
import { WYSIWYG } from "~/components/dynamic";
import { FullPage, MainSection, StackedForm, Title } from "~/components/theme";
import { authorize } from "~/lib/authorize";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";
import { Toast, useToastMessage } from "~/lib/useToastMessage";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const auth = await authorize.theme(db, getServerAuthSession(context), {
    id: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .parse(context.query.themeid),
  });
  if (!auth.read) {
    return authorize.redirectToLogin;
  }
  return {
    props: {
      theme: await db.theme.findUniqueOrThrow({
        where: { id: auth.themeid },
        include: {
          themeSubscription: {
            where: {
              userId: auth.userId,
            },
          },
        },
      }),
      auth,
    },
  };
};

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  const [dirty, setDirty] = useState(false);
  const editJournal = api.journals.edit.useMutation();
  const editorRef = useRef<UnprivilegedEditor>(null);

  const subscribeApi = api.journals.subscribe.useMutation();
  const toast = useToastMessage();

  return (
    <JournalScopeLayout themeid={props.auth.themeid}>
      <FullPage>
        <Title>{props.theme.name}</Title>
        <MainSection>
          <StackedForm.Main
            onSubmit={() => {
              const quillData = getQuillData(editorRef);
              void editJournal
                .mutateAsync({
                  themeId: props.theme.id,
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
                  editable={props.auth.write}
                  defaultValue={props.theme.quill}
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
                defaultChecked={props.theme.themeSubscription.length > 0}
                onChange={(x) => {
                  void subscribeApi
                    .mutateAsync({
                      subscribe: x,
                      themeId: props.theme.id,
                    })
                    .then(() => {
                      toast.newToast(
                        `Successfully ${
                          x ? "subscribed to" : "unsubscribed from"
                        } notifications to this journal`,
                        400000,
                      );
                    });
                }}
              />
            </StackedForm.Section>
          </StackedForm.Main>
        </MainSection>
      </FullPage>
      <Toast {...toast}/>
    </JournalScopeLayout>
  );
};

export default Page;
