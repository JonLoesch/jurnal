import { CheckIcon, CursorArrowRaysIcon } from "@heroicons/react/24/outline";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { DeltaStatic } from "quill";
import { FC, useRef, useState } from "react";
import ReactQuill from "react-quill";
import { z } from "zod";
import { JournalScopeLayout } from "~/components/Layout";
import { getQuillData } from "~/components/WYSIWYG";
import { WYSIWYG } from "~/components/dynamic";
import { FullPage, MainSection, StackedForm, Title } from "~/components/theme";
import { authorize } from "~/lib/authorize";
import { getServerAuthSession } from "~/server/auth";
import { db } from "~/server/db";
import { api } from "~/utils/api";

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
      theme: await db.theme.findUniqueOrThrow({ where: { id: auth.themeid } }),
      auth,
    },
  };
};

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (
  props,
) => {
  const [dirty, setDirty] = useState(false);
  const editJournal = api.journals.edit.useMutation();
  const quillRef = useRef<ReactQuill>(null);

  return (
    <JournalScopeLayout themeid={props.auth.themeid}>
      <FullPage>
        <Title>{props.theme.name}</Title>
        <MainSection>
          <StackedForm.Main
            onSubmit={() => {
              debugger;
              const quillData = getQuillData(quillRef);
              void editJournal
                .mutateAsync({
                  themeId: props.theme.id,
                  quill: quillData.full,
                  description: quillData.firstLine,
                })
                .then(() => setDirty(false));
            }}
          >
            <StackedForm.SectionItem>
              <WYSIWYG
                quillRef={quillRef}
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
          </StackedForm.Main>
        </MainSection>
      </FullPage>
    </JournalScopeLayout>
  );
};

export default Page;
