import dynamic from "next/dynamic";

export const WYSIWYG = dynamic(
  () => import("~/components/WYSIWYG").then((x) => x.ClientImpl_WYSIWYG),
  {
    ssr: false,
  },
);

export const LineChart = dynamic(
  () => import("recharts").then((x) => x.LineChart),
  {
    ssr: false,
  },
);

export const ReactJsonDebugView = dynamic(() => import("react-json-view"), {
  ssr: false,
});

export const MetricGroupEditor = dynamic(
  () =>
    import("~/components/MetricGroupEditor").then(
      (x) => x.ClientImpl_MetricGroupEditor,
    ),
  {
    ssr: false,
  },
);
