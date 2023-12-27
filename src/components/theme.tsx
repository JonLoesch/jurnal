import { FC, Fragment, PropsWithChildren, ReactNode, useRef } from "react";
import { useTooltipWatch } from "~/lib/hoveredElement";
import { ifElse } from "~/lib/ifElse";
import { Locator, SafeLink } from "~/lib/urls";

export const Header: FC<PropsWithChildren> = (props) => {
  return (
    <header>
      <div className="mx-auto mb-4 max-w-7xl px-4 sm:px-6 lg:px-8">
        {props.children}
      </div>
    </header>
  );
};
export const Title: FC<PropsWithChildren> = (props) => {
  return (
    <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
      {props.children}
    </h1>
  );
};
export const Subtitle: FC<PropsWithChildren> = (props) => {
  return <div className="mx-0 sm:mx-4 lg:mx-10">{props.children}</div>;
};
export const MainSection: FC<PropsWithChildren> = (props) => {
  return (
    <main>
      <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        {props.children}
      </div>
    </main>
  );
};
export const FullPage: FC<PropsWithChildren> = (props) => {
  return <div className="py-10"> {props.children}</div>;
};

export const Groups = {
  GroupSection(props: PropsWithChildren) {
    return <div className="flex flex-col gap-3">{props.children}</div>;
  },
  Group(
    props: PropsWithChildren<{
      title: string;
      description?: string;
      controls?: ReactNode[];
    }>,
  ) {
    return (
      <div className="grid grid-cols-[250px_1fr] items-start gap-y-3 border-l-2 border-neutral bg-base-300 py-3">
        <div className="sticky -top-1 z-10 col-span-2 bg-neutral p-2 text-lg text-neutral-content opacity-100">
          <div className="flex flex-row items-center justify-between">
            <div>{props.title}</div>
            <div className="flex flex-row items-center gap-2">
              {props.controls}
            </div>
          </div>
        </div>
        <div className="col-span-2 pl-7 text-gray-400">{props.description}</div>
        {props.children}
      </div>
    );
  },
  Item(props: PropsWithChildren<{ title: string; description?: string }>) {
    return (
      <>
        <div
          className="group tooltip tooltip-bottom col-span-2  h-auto p-2 pl-4 text-left md:tooltip-right md:col-span-1 md:py-5"
          data-tip={props.description}
        >
          {props.title}
        </div>
        <div className="col-span-2 pl-7 pr-3 md:col-span-1 md:py-5 md:pl-0 md:pr-6">
          {props.children}
        </div>
      </>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, FC<any>>;

export const Forms = {
  Form(props: PropsWithChildren<{ onSubmit: () => void }>) {
    return (
      <form
        onSubmit={(e) => {
          props.onSubmit();
          e.preventDefault();
        }}
      >
        {props.children}
      </form>
    );
  },

  SubmitButton(
    props: PropsWithChildren<{ disabled?: boolean; label: string }>,
  ) {
    return (
      <button
        type="submit"
        className="flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:bg-gray-300"
        disabled={props.disabled}
      >
        <span>{props.label}</span>
        <span>{props.children}</span>
      </button>
    );
  },

  Checkbox(props: {
    inputKey: string;
    label: string;
    defaultChecked: boolean;
    onChange: (checked: boolean) => void;
  }) {
    return (
      <div className="form-control col-span-full">
        <label
          htmlFor={props.inputKey}
          className="label cursor-pointer justify-start text-sm font-medium leading-6 text-gray-900"
        >
          <input
            type="checkbox"
            className="checkbox-primary checkbox mr-4 sm:mr-8"
            name={props.inputKey}
            id={props.inputKey}
            defaultChecked={props.defaultChecked}
            onChange={(e) => {
              props.onChange(e.target.checked);
            }}
          />
          <span className="label-text">{props.label}</span>
        </label>
      </div>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, FC<any>>;

// export const StackedForm = {
//   // CancelButton() {
//   //   return (
//   //     <button
//   //       type="button"
//   //       className="text-sm font-semibold leading-6 text-gray-900"
//   //     >
//   //       Cancel
//   //     </button>
//   //   );
//   // },
//   // eslint-disable-next-line @typescript-eslint/no-explicit-any
// } satisfies Record<string, FC<any>>;

type Action = Locator | { page: "action"; handler: () => void };

export const Cards = {
  List(props: PropsWithChildren) {
    return <div className="grid-cell-90">{props.children}</div>;
  },
  PaddedCard(
    props: PropsWithChildren<{ actions: Array<Action & { title: string }> }>,
  ) {
    return (
      <div className="flex flex-col overflow-hidden rounded-lg bg-white shadow [&>*]:px-4 [&>*]:sm:px-6">
        <div className="py-5 sm:py-6">{props.children}</div>
        {/* <div className="ml-16 flex items-baseline pb-6 sm:pb-7"> */}
        <div className="flex h-12 items-center justify-between bg-gray-50 text-sm font-medium text-indigo-600 hover:text-indigo-500">
          {props.actions.map((action, index) => (
            <Fragment key={action.page}>
              {index !== 0 && (
                <div className="h-full py-2">
                  <div className="h-full border-l border-gray-300"></div>
                </div>
              )}
              {action.page !== "action" && (
                <SafeLink {...action}>{action.title}</SafeLink>
              )}
              {action.page === "action" && (
                <button onClick={action.handler}>{action.title}</button>
              )}
            </Fragment>
          ))}
        </div>
        {/* </div> */}
      </div>
    );
  },
} satisfies Record<string, FC<never>>;
