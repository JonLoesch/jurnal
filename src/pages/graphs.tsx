import { ArrowDownIcon, ArrowUpIcon } from "@heroicons/react/24/outline";
import { Prisma } from "@prisma/client";
import { GetServerSidePropsContext, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { FC, PropsWithChildren } from "react";
import { getMetricMetadata } from "~/lib/getMetricMetadata";
import { db } from "~/server/db";

export const GraphLayout: FC<
  PropsWithChildren<{
    metrics: Array<
      Prisma.MetricGetPayload<true> & {
        latestValue?: number;
      }
    >;
  }>
> = (props) => {
  const { metrics } = props;

  return (
    <div>
      <dl className="grid-cell-90 mt-5 grid gap-5">
        {metrics.map((item) => (
          <div
            key={item.key}
            className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
          >
            <dt>
              <div className="absolute flex h-12 w-12 rounded-md bg-indigo-500 p-3">
                <span className=" w-full text-center font-bold text-white">
                  {item.latestValue}
                </span>
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">
                {item.key}
              </p>
            </dt>
            <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
              {/* <p className="text-2xl font-semibold text-gray-900">
                {item.stat}
              </p>
              <p
                className={classNames(
                  "item.changeType" === "increase"
                    ? "text-green-600"
                    : "text-red-600",
                  "ml-2 flex items-baseline text-sm font-semibold",
                )}
              >
                {"item.changeType" === "increase" ? (
                  <ArrowUpIcon
                    className="h-5 w-5 flex-shrink-0 self-center text-green-500"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowDownIcon
                    className="h-5 w-5 flex-shrink-0 self-center text-red-500"
                    aria-hidden="true"
                  />
                )}
                <span className="sr-only">
                  {" "}
                  {"item.changeType" === "increase"
                    ? "Increased"
                    : "Decreased"}{" "}
                  by{" "}
                </span>
                item.change
              </p> */}
              &nbsp;
              <div className="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
                <div className="text-sm">
                  <Link
                    href={{
                      pathname: "/graphs/[metric]",
                      query: {
                        metric: item.key,
                      },
                    }}
                    className="font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View all<span className="sr-only"> {item.name} stats</span>
                  </Link>
                </div>
              </div>
            </dd>
          </div>
        ))}
      </dl>
      {props.children}
    </div>
  );
};

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  return {
    props: {
      metrics: await getMetricMetadata(),
    },
  };
};

export default function Page(
  props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return <GraphLayout metrics={props.metrics} />;
}
