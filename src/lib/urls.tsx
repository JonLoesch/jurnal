import Link from "next/link";
import { PropsWithChildren, ReactNode } from "react";
import { env } from "~/env.mjs";
import { Link as UnderlyingEmailLink } from "@react-email/link";
import { usePathname } from "next/navigation";
import { z } from "zod";

export type Locator =
  | {
      page: "index";
    }
  | {
      page: "myJournals";
    }
  | {
      page: "viewPost";
      postId: number;
    }
  | {
      page: "editPost";
      postId: number;
    }
  | {
      page: "viewTimeline";
      journalId: number;
    }
  | {
      page: "viewMetrics";
      journalId: number;
    }
  | {
      page: "viewJournal";
      journalId: number;
    }
  | {
      page: "editJournal";
      journalId: number;
    }
  | {
      page: "viewSpecificMetric";
      metricId: string;
    };

export type OptionalLocator =
  | (Locator & { link?: "enabled" })
  | (Partial<Locator> & { link: "disabled" });

export function RelativeToRoot(locator: Locator): string {
  switch (locator.page) {
    case "index":
      return `/`;
    case "myJournals":
      return `/journals`;
    case "viewPost":
    case "editPost":
      return `/posts/edit/${locator.postId}`;
    case "viewJournal":
    case "editJournal":
      return `/journal/${locator.journalId}`;
    case "viewTimeline":
      return `/journal/${locator.journalId}/posts`;
    case "viewMetrics":
      return `/journal/${locator.journalId}/graphs`;
    case "viewSpecificMetric":
      return `/graphs/${locator.metricId}`;
  }
}

const coerceNumber = z.string().regex(/^\d+$/).transform(Number);
export const fromUrl = {
  noparams: z.object({}),
  themeid: z.object({
    themeid: coerceNumber,
  }),
  postid: z.object({
    postid: coerceNumber,
  }),
  metrickey: z.object({
    metrickey: z.string().min(1)
  })

}

// type Params<Page extends Locator["page"]> = Omit<
//   Locator & { page: Page },
//   "page"
// >;
// type ZodParams<Params extends Record<string, unknown>> = {
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
//   [K in keyof Params]: z.ZodType<Params[K], any, string>;
// };
// function buildZodValidators(): {
//   [Page in Locator["page"]]: z.ZodObject<ZodParams<Params<Page>>>;
// } {
//   return {
//     index: fromUrl.noparams,
//     editJournal: fromUrl.themeid,
//     editPost: fromUrl.postid,
//     myJournals: fromUrl.noparams,
//     viewJournal: fromUrl.themeid,
//     viewMetrics: fromUrl.themeid,
//     viewPost: fromUrl.postid,
//     viewSpecificMetric: fromUrl.metrickey,
//     viewTimeline: fromUrl.themeid,
//   };
// }
// export const zodParams = buildZodValidators();

function FullyQualified(locator: Locator): string {
  // slightly lazy here to reuse the NEXTAUTH env var :(
  return `${env.NEXTAUTH_URL}${RelativeToRoot(locator)}`;
}
export function SafeLink(props: PropsWithChildren<OptionalLocator>): ReactNode {
  const currentPath = usePathname();
  if (props.link === "disabled") {
    return <div>{props.children}</div>;
  }
  const href = RelativeToRoot(props);

  const isActive = pathnameOf(href) === pathnameOf(currentPath);
  return (
    <Link href={href} className={isActive ? "link-active" : ""}>
      {props.children}
    </Link>
  );

  function pathnameOf(href: string) {
    return href;
    return new URL(href).pathname;
  }
}
export function EmailLink(props: PropsWithChildren<Locator>): ReactNode {
  return (
    <UnderlyingEmailLink href={FullyQualified(props)}>
      {props.children}
    </UnderlyingEmailLink>
  );
}
