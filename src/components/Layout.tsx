import React, {
  FC,
  Fragment,
  FunctionComponent,
  PropsWithChildren,
} from "react";
import { Menu, Transition } from "@headlessui/react";
import {
  Bars3Icon,
  BellIcon,
  UserCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "~/images/logo.jpg";
import { signIn, signOut, useSession } from "next-auth/react";
import { ifElse } from "~/lib/ifElse";
import { Locator, SafeLink } from "~/lib/urls";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

const userMenuPages: Pages = [{ page: "myJournals", title: "My Journals" }];
const home: Pages[0] = { page: "index", title: "Home" };

export const UnscopedLayout: FC<PropsWithChildren> = (props) => {
  return (
    <Layout pages={[]} userMenuPages={userMenuPages}>
      {props.children}
    </Layout>
  );
};
export const JournalScopeLayout: FC<PropsWithChildren<{ themeid: number }>> = (
  props,
) => {
  return (
    <Layout
      pages={[
        { page: "viewJournal", title: "Journal", themeid: props.themeid },
        { page: "viewTimeline", title: "Timeline", themeid: props.themeid },
        { page: "viewMetrics", title: "Graphs", themeid: props.themeid },
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

const LargeLayout: FC<LayoutProps> = (props) => {
  const session = useSession();

  return (
    <div>
      <Menu as="nav" className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <SafeLink page="index">
                  <Image
                    src={logo}
                    className="h-8 w-auto"
                    alt="Jurnal"
                    priority
                  />
                </SafeLink>
              </div>
              <div className="ml-6 flex space-x-8">
                {props.pages.map((p) => (
                  <div
                    key={p.page}
                    className="inline-flex items-center  text-sm font-medium"
                  >
                    <SafeLink {...p}>
                      <div className="border-b-2  border-transparent px-1 pt-1 text-gray-900 link-active:border-indigo-500 link-active:text-gray-500 link-active:hover:border-gray-300 link-active:hover:text-gray-700">
                        {p.title}
                      </div>
                    </SafeLink>
                  </div>
                ))}
              </div>
            </div>

            <div className="ml-6 flex items-center">
              {/* Profile dropdown */}
              <div className="relative ml-3">
                <div>
                  <Menu.Button
                    className="relative flex rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    <span className="absolute -inset-1.5" />
                    <span className="sr-only">Open user menu</span>
                    {ifElse(
                      session.data?.user.image,
                      (src) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="h-8 w-8 rounded-full"
                          src={src}
                          alt=""
                        />
                      ),
                      () => (
                        <UserCircleIcon className="h-8 w-8" />
                      ),
                    )}
                  </Menu.Button>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-200"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          className={classNames(
                            active ? "bg-gray-100" : "",
                            "block w-full px-4 py-2 text-left text-sm text-gray-700",
                          )}
                          onClick={
                            session.data?.user
                              ? () => void signOut()
                              : () => void signIn()
                          }
                        >
                          {session.data?.user ? "Sign out" : "Sign in"}
                        </button>
                      )}
                    </Menu.Item>
                    {props.userMenuPages.map((p) => (
                      <Menu.Item key={p.page}>
                        <div className="text-left text-sm text-gray-700 ui-active:bg-gray-100">
                          <SafeLink {...p}>
                            <div className="px-4 py-2">{p.title}</div>
                          </SafeLink>
                        </div>
                      </Menu.Item>
                    ))}
                  </Menu.Items>
                </Transition>
              </div>
            </div>
          </div>
        </div>
      </Menu>
      {props.children}
    </div>
  );
};

const SmallItem: FC<PropsWithChildren> = ({ children }) => {
  return (
    <div className="block border-l-4 border-transparent text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700">
      {children}
    </div>
  );
};
const SmallLink: FC<Pages[0]> = (props) => {
  return (
    <div className="block border-l-4 border-transparent text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"></div>
  );
};
const SmallLayout: FC<LayoutProps> = (props) => {
  const session = useSession();

  return (
    <div>
      <Menu as="nav" className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 justify-between">
            <div className="flex">
              <div className="flex flex-shrink-0 items-center">
                <SafeLink page="index">
                  <Image
                    src={logo}
                    className="h-8 w-auto ui-open:hidden"
                    alt="Jurnal"
                    priority
                  />
                </SafeLink>
              </div>
            </div>

            <div className="-mr-2 flex items-center">
              {/* Mobile menu button */}
              <Menu.Button>
                <div className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                  <span className="absolute -inset-0.5" />
                  <span className="sr-only">Open main menu</span>
                  <XMarkIcon
                    className="block h-6 w-6 ui-not-open:hidden"
                    aria-hidden="true"
                  />
                  <Bars3Icon
                    className="block h-6 w-6 ui-open:hidden"
                    aria-hidden="true"
                  />
                </div>
              </Menu.Button>
            </div>
          </div>
        </div>

        <Menu.Items>
          <div className="-mt-10 space-y-1 pb-3">
            {[home, ...props.pages].map((p) => (
              <SmallItem {...p} key={p.page}>
                <SafeLink {...p}>
                  <div className="py-2 pl-3 pr-4">{p.title}</div>
                </SafeLink>
              </SmallItem>
            ))}
          </div>
          <div className="border-t border-gray-200 pb-3 pt-4">
            {ifElse(
              session.data?.user,
              (u) => (
                <>
                  <div className="mb-3 flex items-center px-4">
                    <div className="flex-shrink-0">
                      {u.image !== null && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="h-10 w-10 rounded-full"
                          src={u.image}
                          alt=""
                        />
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-gray-800">
                        {u.name}
                      </div>
                      <div className="text-sm font-medium text-gray-500">
                        {u.email}
                      </div>
                    </div>
                    {/* <button
                        type="button"
                        className="relative ml-auto flex-shrink-0 rounded-full bg-white p-1 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        <span className="absolute -inset-1.5" />
                        <span className="sr-only">View notifications</span>
                        <BellIcon className="h-6 w-6" aria-hidden="true" />
                      </button> */}
                  </div>
                  <SmallItem>
                    <button
                      onClick={() => void signOut()}
                      className="w-full py-2 pl-3 pr-4 text-left"
                    >
                      Sign out
                    </button>
                  </SmallItem>
                  {props.userMenuPages.map((p) => (
                    <SmallItem key={p.page} {...p}>
                      <SafeLink {...p}>
                        <div className="py-2 pl-3 pr-4">{p.title}</div>
                      </SafeLink>
                    </SmallItem>
                  ))}
                </>
              ),
              () => (
                <SmallItem>
                  <button
                    onClick={() => void signIn()}
                    className="w-full py-2 pl-3 pr-4 text-left"
                  >
                    Sign In
                  </button>
                </SmallItem>
              ),
            )}
          </div>
        </Menu.Items>
      </Menu>
      {props.children}
    </div>
  );
};

const Layout: FC<LayoutProps> = (props) => {
  const pathname = usePathname();

  return (
    <>
      <div className="max-sm:hidden">
        <LargeLayout {...props} />
      </div>
      <div className="sm:hidden">
        <SmallLayout {...props} />
      </div>
    </>
  );
};
