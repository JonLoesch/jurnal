import { FC, PropsWithChildren } from "react";

export const Title: FC<PropsWithChildren> = (props) => {
  return (
    <header>
      <div className="mx-auto mb-4 max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-gray-900">
          {props.children}
        </h1>
      </div>
    </header>
  );
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
