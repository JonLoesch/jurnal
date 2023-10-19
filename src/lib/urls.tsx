import Link from "next/link";
import { PropsWithChildren, ReactNode } from "react";
import { env } from "~/env.mjs";
import { Link as UnderlyingEmailLink } from "@react-email/link";

export type Locator =
  | {
      page: "viewPost";
      postid: number;
    }
  | {
      page: "editPost";
      postid: number;
    };

export function RelativeToRoot(locator: Locator): string {
  switch (locator.page) {
    case "viewPost":
    case "editPost":
      return `/posts/edit/${locator.postid}`;
  }
}
function FullyQualified(locator: Locator): string {
  // slightly lazy here to reuse the NEXTAUTH env var :(
  return `${env.NEXTAUTH_URL}${RelativeToRoot(locator)}`;
}
export function SafeLink(props: PropsWithChildren<Locator>): ReactNode {
  return <Link href={RelativeToRoot(props)}>{props.children}</Link>;
}
export function EmailLink(props: PropsWithChildren<Locator>): ReactNode {
  return (
    <UnderlyingEmailLink href={FullyQualified(props)}>
      {props.children}
    </UnderlyingEmailLink>
  );
}
