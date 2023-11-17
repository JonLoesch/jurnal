import { FC, createElement } from "react";
import { Metric, MetricSchemaAndValue, MetricType } from "~/lib/metricSchemas";
import { zeroToTen as Ze, zeroToTen } from "./zeroToTen";
import { api } from "~/utils/api";

type MetricEditProps<T extends MetricType> = {
  name: string;
  metricId: string;
  value: Metric<T>["value"];
  onChange: (change: Metric<T>["change"] | null) => void;
  schema: Metric<T>["schema"];
};
type MetricViewProps<T extends MetricType> = Omit<
  MetricEditProps<T>,
  "onChange"
>;

export type MetricUI<T extends MetricType> = {
  edit: FC<MetricEditProps<T>>;
  view: FC<MetricViewProps<T>>;
};

export const GenericMetricAdjust: FC<
  MetricSchemaAndValue & { name: string; metricId: string, postId: number }
> = (props) => {
  const editValue = api.posts.editValue.useMutation();
  switch (props.metricType) {
    case "zeroToTen":
      return <zeroToTen.edit {...props} onChange={change => editValue.mutate({
        metricId: props.metricId,
        postId: props.postId,
        change,
      })} />;
    case "checkbox":
    case "numeric":
    case "richText":
      return <>Generic placeholder {props.metricType}</>;
  }
};
