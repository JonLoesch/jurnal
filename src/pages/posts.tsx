import {
  BookOpenIcon,
} from "@heroicons/react/24/solid";
import { format, formatISO, getUnixTime } from "date-fns";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { useSession } from "next-auth/react";
import { FC } from "react";
import { db } from "~/server/db";
import { LinkToEditPost } from "./posts/edit/[postid]";
import { api } from "~/utils/api";
import { useRouter } from "next/router";
import PulseIcon from "~/images/heart-pulse-solid.svg";
import Image from "next/image";
import { FullPage, MainSection, Title } from "~/components/theme";
import { Zoneless } from "~/lib/ZonelessDate";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  return {
    props: {
      entries: (
        await db.entry.findMany({
          orderBy: {
            date: "asc",
          },
        })
      ).map(({ date, ...rest }) => ({
        ...rest,
        date: Zoneless.fromDate(date),
      })),
    },
  };
};

const Page: FC<InferGetServerSidePropsType<typeof getServerSideProps>> = ({
  entries,
}) => {
  const addPost = api.posts.create.useMutation();
  const router = useRouter();
  const session = useSession();

  if (addPost.isSuccess) {
    void router.push({
      pathname: "posts/edit/[postid]",
      query: {
        postid: addPost.data,
      },
    });
  }
  // return (
  //   <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 ring-8 ring-white">
  //     <Image src={PulseIcon} className="w-5 h-5"
  //   aria-hidden="true"
  //     />
  //   </span>
  // );
  return (
    <FullPage>
      <Title>Timeline</Title>
      <MainSection>
        <ul role="list" className="-mb-8">
          {entries.map((entry, index) => {
            const date = Zoneless.toDate(entry.date);
            const entryType =
              entry.postQuill === null || entry.postQuill === undefined
                ? "metric_recorded"
                : "journal_entry";
            return (
              <li key={getUnixTime(date)}>
                <LinkToEditPost postid={entry.id}>
                  <div className="relative pb-8">
                    {index !== entries.length - 1 ? (
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
                            <p className="overflow-hidden max-h-[3.75rem]">{entry.postText}</p>
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
                </LinkToEditPost>
              </li>
            );
          })}
        </ul>

        {session.data?.user.role === 'journaler' && (
          <div className="mt-16 flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => {
                addPost.mutate();
              }}
            >
              New Post
            </button>
          </div>
        )}
      </MainSection>
    </FullPage>
  );
};
export default Page;
