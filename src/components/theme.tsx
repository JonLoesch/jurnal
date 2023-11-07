import { FC, Fragment, PropsWithChildren } from "react";
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
export const Subtitle : FC<PropsWithChildren> = props => {
  return <div className="mx-0 sm:mx-4 lg:mx-10">
    {props.children}
  </div>
}
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

export const StackedForm = {
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
  CancelButton() {
    return (
      <button
        type="button"
        className="text-sm font-semibold leading-6 text-gray-900"
      >
        Cancel
      </button>
    );
  },
  ButtonPanel(props: PropsWithChildren) {
    return (
      <div className="flex items-center justify-end gap-x-6 border-t border-gray-900/10 px-4 py-4 sm:px-8">
        {props.children}
      </div>
    );
  },
  Main(props: PropsWithChildren<{ onSubmit: () => void }>) {
    return (
      <div className="space-y-10 divide-y divide-gray-900/10  backdrop-brightness-95 sm:p-8">
        <form
          onSubmit={(e) => {
            props.onSubmit();
            e.preventDefault();
          }}
        >
          {props.children}
        </form>
      </div>
    );
  },
  SectionHeader(props: { title: string; description?: string }) {
    return (
      <div className="px-4 sm:px-0">
        <h2 className="text-base font-semibold leading-7 text-gray-900">
          {props.title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          {props.description}
        </p>
      </div>
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
  // TextArea(props: {
  //   metricKey: string;
  //   label: string;
  //   text: string | null;
  //   onChange: (text: string | null) => void;
  //   placeholder?: string;
  // }) {
  //   return (
  //     <div className="col-span-full form-control">
  //       <label
  //         htmlFor={props.metricKey}
  //         className="block text-sm font-medium leading-6 text-gray-900"
  //       >
  //         {props.label}
  //       </label>
  //       <div className="mt-2">
  //         <textarea
  //           id={props.metricKey}
  //           name={props.metricKey}
  //           rows={3}
  //           className="block w-full rounded-md border-0 px-2 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
  //           value={props.text ?? ""}
  //           onChange={(e) =>
  //             props.onChange(e.target.value === "" ? null : e.target.value)
  //           }
  //           placeholder={props.placeholder}
  //         />
  //       </div>
  //     </div>
  //   );
  // },
  SectionItem(props: PropsWithChildren) {
    return <div className="col-span-full bg-white"> {props.children}</div>;
  },
  Section(props: PropsWithChildren<{ title: string; description?: string }>) {
    return (
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 pt-10 first:pt-0 md:grid-cols-3">
        <StackedForm.SectionHeader
          title={props.title}
          description={props.description}
        />
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl md:col-span-2">
          <div className="px-4 py-6 sm:p-8">
            <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              {props.children}
            </div>
          </div>
        </div>
      </div>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} satisfies Record<string, FC<any>>;

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
