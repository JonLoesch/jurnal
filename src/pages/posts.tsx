import { HandThumbUpIcon } from "@heroicons/react/24/outline";
import { FC } from "react";
import { data } from "~/lib/fakeData";

export const Posts: FC = () => {
  const { entries } = data;

  return (
    <div className="flow-root max-w-lg mx-auto mt-12">
      <ul role="list" className="-mb-8">
        {entries.map((entry, eventIdx) => (
          <li key={entry.date}>
            <div className="relative pb-8">
              {eventIdx !== entries.length - 1 ? (
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
                      Some stuff happened on {entry.date}{" "}
                      {/* <a
                        href={entry.href}
                        className="font-medium text-gray-900"
                      > */}
                      {entry.date}
                      {/* </a> */}
                    </p>
                  </div>
                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                    <time dateTime={entry.date.replace(/^Sep /, "2023-09-")}>
                      {entry.date}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
export default Posts;
