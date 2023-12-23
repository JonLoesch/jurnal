import React, {
  FC,
  Fragment,
  FunctionComponent,
  MutableRefObject,
  PropsWithChildren,
  createContext,
  useEffect,
  useRef,
} from "react";
import { Menu, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  BellIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  XCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "~/images/logo.jpg";
import { signIn, signOut, useSession } from "next-auth/react";
import { ifElse } from "~/lib/ifElse";
import { Locator, SafeLink } from "~/lib/urls";
import { useApiConditions, useCondition } from "~/lib/watcher";

const userMenuPages: Pages = [{ page: "myJournals", title: "My Journals" }];
const home: Pages[0] = { page: "index", title: "Home" };

export const UnscopedLayout: FC<PropsWithChildren> = (props) => {
  return (
    <Layout pages={[]} userMenuPages={userMenuPages}>
      {props.children}
    </Layout>
  );
};
export const JournalScopeLayout: FC<
  PropsWithChildren<{ journalId: number }>
> = (props) => {
  return (
    <Layout
      pages={[
        { page: "viewJournal", title: "Journal", journalId: props.journalId },
        { page: "viewTimeline", title: "Timeline", journalId: props.journalId },
        { page: "viewMetrics", title: "Graphs", journalId: props.journalId },
        // { pathname: "/journal/[themeid]/notifications", title: "Notifications" },
        // { href: "/todo", title: "Todo list" },
      ]}
      userMenuPages={userMenuPages}
    >
      {props.children}
    </Layout>
  );
};

type Pages = Array<
  Locator & {
    title: string;
  }
>;

type LayoutProps = PropsWithChildren<{
  pages: Pages;
  userMenuPages: Pages;
}>;




// For explanation of 'tabIndex={0}':
// https://daisyui.com/components/dropdown/#method-2-using-label-and-css-focus

const Logo = (props: { className?: string }) => {
  return <Image src={logo} alt="Jurnal" priority className={props.className} />;
};
const UserWidget: FC<Pick<LayoutProps, "userMenuPages">> = (props) => {
  const session = useSession();

  if (!session.data?.user) {
    return (
      <button onClick={() => void signIn()} className="btn">
        <UserCircleIcon className="max-md:hidden" />
        Sign in
      </button>
    );
  }
  return (
    <div className="dropdown dropdown-end dropdown-bottom">
      <label tabIndex={0} className="btn btn-ghost flex flex-row">
        {ifElse(
          session.data.user.image,
          (i) => (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="h-10 w-10 rounded-full" src={i} alt="" />
              <span className="max-md:hidden"> {session.data.user.name} </span>
            </>
          ),
          () => (
            <>
              <span> {session.data.user.name ?? "My profile"} </span>
            </>
          ),
        )}
      </label>
      <ul tabIndex={0} className="menu dropdown-content">
        <li>
          <a onClick={() => void signOut()}>Sign out</a>
        </li>
        {props.userMenuPages.map((p) => (
          <li key={p.title}>
            <SafeLink {...p}>{p.title}</SafeLink>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Alert = () => {
  const c = useApiConditions();
  const apiErrored = useCondition(c.apiErrored);
  const apiLoadingOverTwoSeconds = useCondition(c.apiLoadingOverTwoSeconds);

  if (apiErrored) {
    return (
      <div className="alert alert-error">
        <XCircleIcon className="h-6 shrink-0" />
        An error occured while saving.
      </div>
    );
  } else if (apiLoadingOverTwoSeconds) {
    return (
      <div className="alert alert-warning">
        <ExclamationTriangleIcon className="h-6 shrink-0" />
        Saving...
      </div>
    );
  } else {
    return null
  }
};

const Layout: FC<LayoutProps> = (props) => {
  return (
    <div className="fixed inset-0 flex flex-col">
      <div className="navbar flex-none bg-base-100 ">
        <div className="navbar-start">
          <div className="dropdown dropdown-bottom md:hidden">
            <label tabIndex={0} className="btn btn-ghost md:hidden">
              <Bars3Icon className="h-5 w-5" />
            </label>
            <ul
              tabIndex={0}
              className="menu dropdown-content menu-sm w-52"
            >
              <li>
                <SafeLink page="index">Home page</SafeLink>
              </li>
              {props.pages.map((p) => (
                <li key={p.title}>
                  <SafeLink {...p}>{p.title}</SafeLink>
                </li>
              ))}
            </ul>
          </div>
          <div className="btn btn-ghost max-md:hidden">
            <SafeLink page="index">
              <Logo className="h-8 w-auto" />
            </SafeLink>
          </div>
        </div>
        <div className="navbar-center">
          <ul className="menu menu-horizontal px-1 max-md:hidden">
            {props.pages.map((p) => (
              <li key={p.title}>
                <SafeLink {...p}>{p.title}</SafeLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="navbar-end">
          <UserWidget userMenuPages={props.userMenuPages} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">{props.children}</div>
      <div className="toast px-8 max-md:toast-top max-md:toast-center">
        <Alert/>
      </div>
    </div>
  );
};
