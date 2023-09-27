import React, {
  FC,
  Fragment,
  FunctionComponent,
  PropsWithChildren,
} from "react";
import { Disclosure, Menu, Transition } from "@headlessui/react";
import { Bars3Icon, BellIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "~/images/logo.jpg";

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

interface TopLevelPage {
  href: string;
  title: string;
}

const top: TopLevelPage[] = [
  { href: "/", title: "Home" },
  { href: "/posts", title: "All Posts" },
  { href: "/graphs", title: "Graphs" },
  { href: "/notifications", title: "Notifications" },
  { href: "/todo", title: "Todo list" },
];

export const Layout: FC<PropsWithChildren> = (props) => {
  const pathname = usePathname();

  return (
    <div>
      <Disclosure as="nav" className="bg-white shadow">
        {({ open }) => (
          <>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="flex h-16 justify-between">
                <div className="flex">
                  <div className="flex flex-shrink-0 items-center">
                    <Image src={logo} className="h-8 w-auto" alt="Jurnal" />
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    {top.map((t, index) => (
                      <Link
                        href={t.href}
                        key={t.href}
                        className={`inline-flex items-center border-b-2  px-1 pt-1 text-sm font-medium  ${
                          t.href === pathname
                            ? "border-indigo-500 text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            : "border-transparent text-gray-900"
                        }`}
                      >
                        {t.title}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="-mr-2 flex items-center sm:hidden">
                  {/* Mobile menu button */}
                  <Disclosure.Button className="relative inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
                    <span className="absolute -inset-0.5" />
                    <span className="sr-only">Open main menu</span>
                    {open ? (
                      <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                    )}
                  </Disclosure.Button>
                </div>
              </div>
            </div>

            <Disclosure.Panel className="sm:hidden">
              <div className="space-y-1 pb-3 pt-2">
                {/* Current: "bg-indigo-50 border-indigo-500 text-indigo-700", Default: "border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700" */}

                {top.map((t, index) => (
                  <Disclosure.Button
                    key={t.href}
                    className="block border-l-4 border-transparent py-2 pl-3 pr-4 text-base font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <Link href={t.href}>{t.title}</Link>
                  </Disclosure.Button>
                ))}
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
      {props.children}
    </div>
  );
};
