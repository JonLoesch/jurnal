import { BookOpenIcon } from "@heroicons/react/24/solid";
import { format, formatISO, getUnixTime } from "date-fns";
import {
  InferGetServerSidePropsType,
} from "next";
import { FC } from "react";
import { api } from "~/utils/api";
import { useRouter } from "next/router";
import PulseIcon from "~/images/heart-pulse-solid.svg";
import Image from "next/image";
import { FullPage, Header, MainSection, Title } from "~/components/theme";
import { Zoneless } from "~/lib/ZonelessDate";
import { JournalScopeLayout } from "~/components/Layout";
import { RelativeToRoot, SafeLink, fromUrl } from "~/lib/urls";
import { withAuth } from "~/model/Authorization";
import { JournalModel } from "~/model/JournalModel";

export const getServerSideProps = withAuth(fromUrl.journalId, (auth, params) => auth.journal(params.journalId, async context => ({
  posts: await new JournalModel(context).posts(),
})));

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = (props) => {
  const addPost = api.posts.create.useMutation();
  const router = useRouter();

  if (addPost.isSuccess) {
    const href = RelativeToRoot({
      page: "editPost",
      postId: addPost.data.newPostId,
    });
    void router.push(href);
  }
  // return (
  //   <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 ring-8 ring-white">
  //     <Image src={PulseIcon} className="w-5 h-5"
  //   aria-hidden="true"
  //     />
  //   </span>
  // );
  return (
    <JournalScopeLayout journalId={props._auth.journal.id}>
      <FullPage>
        <Header>
          <Title>Timeline</Title>
        </Header>
        <MainSection>
          <ul role="list" className="-mb-8">
            {props.posts.map((post, index) => {
              const date = Zoneless.toDate(post.date);
              const entryType =
                post.quillData === null || post.quillData === undefined
                  ? "metric_recorded"
                  : "journal_entry";
              return (
                <li key={post.id}>
                  <SafeLink page="viewPost" postId={post.id}>
                    <div className="relative pb-8">
                      {index !== props.posts.length - 1 ? (
                        <span
                          className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 ring-8 ring-white">
                            {entryType === "metric_recorded" && (
                              <Image
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                src={PulseIcon}
                                alt="Metric Reccorded"
                                className="h-5 w-5"
                                aria-hidden="true"
                              />
                            )}
                            {entryType === "journal_entry" && (
                              <BookOpenIcon
                                fill="currentColor"
                                className="h-5 w-5 text-white"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div className="text-sm text-gray-500">
                            {entryType === "metric_recorded" && (
                              <p>Metrics Recorded</p>
                            )}
                            {entryType === "journal_entry" && (
                              <p className="max-h-[3.75rem] overflow-hidden">
                                {post.text}
                              </p>
                            )}
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            <time
                              dateTime={formatISO(date, {
                                representation: "date",
                              })}
                            >
                              {format(date, "EEEEEE MMM d")}
                            </time>
                          </div>
                        </div>
                      </div>
                    </div>
                  </SafeLink>
                </li>
              );
            })}
          </ul>

          {props._auth.journal.write && (
            <div className="mt-16 flex justify-end">
              <button
                className="btn btn-primary"
                onClick={() => {
                  addPost.mutate({
                    themeId: props._auth.journal.id,
                    date: Zoneless.fromDate(new Date()),
                  });
                }}
              >
                New Post
              </button>
            </div>
          )}
        </MainSection>
      </FullPage>
    </JournalScopeLayout>
  );
};
export default Page;
