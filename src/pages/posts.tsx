import { HandThumbUpIcon } from "@heroicons/react/24/outline";
import { format, formatISO, getUnixTime } from "date-fns";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import { useSession } from "next-auth/react";
import { FC } from "react";
import { db } from "~/server/db";
import { LinkToEditPost } from "./posts/edit/[postid]";
import { api } from "~/utils/api";
import { useRouter } from "next/router";

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  return {
    props: {
      entries: await db.entry.findMany({
        orderBy: {
          date: "asc",
        },
      }),
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
  return (
    <div className="mx-auto mt-12 flow-root max-w-lg">
      <ul role="list" className="-mb-8">
        {entries.map((entry, index) => (
          <li key={getUnixTime(entry.date)}>
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
                      <HandThumbUpIcon
                        fill="currentColor"
                        className="h-5 w-5 text-white"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-500">
                        Some stuff happened on {format(entry.date, "MMM d")}{" "}
                        entry.date
                      </p>
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <time
                        dateTime={formatISO(entry.date, {
                          representation: "date",
                        })}
                      >
                        {format(entry.date, "MMM d")}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </LinkToEditPost>
          </li>
        ))}
      </ul>

      {session.data?.user.isPoster && (
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
    </div>
  );
};
export default Page;
