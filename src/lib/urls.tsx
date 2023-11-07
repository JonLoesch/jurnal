import Link from "next/link";
import { PropsWithChildren, ReactNode } from "react";
import { env } from "~/env.mjs";
import { Link as UnderlyingEmailLink } from "@react-email/link";
import { usePathname } from "next/navigation";

export type Locator =
  | {
      page: "index";
    }
  | {
      page: "myJournals";
    }
  | {
      page: "viewPost";
      postid: number;
    }
  | {
      page: "editPost";
      postid: number;
    }
  | {
      page: "viewTimeline";
      themeid: number;
    }
  | {
      page: "viewMetrics";
      themeid: number;
    }
  | {
      page: "viewJournal";
      themeid: number;
    }
  | {
      page: "editJournal";
      themeid: number;
    }
  | {
      page: "viewSpecificMetric";
      metrickey: string;
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
      return `/posts/edit/${locator.postid}`;
    case "viewJournal":
    case "editJournal":
      return `/journal/${locator.themeid}`;
    case "viewTimeline":
      return `/journal/${locator.themeid}/posts`;
    case "viewMetrics":
      return `/journal/${locator.themeid}/graphs`;
    case "viewSpecificMetric":
      return `/graphs/${locator.metrickey}`;
  }
}
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
