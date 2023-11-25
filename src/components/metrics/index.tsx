import {
  FC,
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Metric, MetricSchemaAndValue, MetricType } from "~/lib/metricSchemas";
import { zeroToTen as Ze, zeroToTen } from "./zeroToTen";
import { RouterInputs, api } from "~/utils/api";
import { useWatchMutation } from "~/lib/watcher";
import { richText } from "./richText";
import { checkbox } from "./checkbox";
import Delta from "quill-delta";

type MetricEditProps<T extends MetricType> = {
  name: string;
  metricId: string;
  value: Metric<T>["value"];
  onChange: (change: Metric<T>["change"] | null) => void;
  postId: number;
  schema: Metric<T>["schema"];
};
type MetricViewProps<T extends MetricType> = Omit<
  MetricEditProps<T>,
  "onChange"
>;

export type MetricUI<T extends MetricType> = {
  Edit: FC<MetricEditProps<T>>;
  View: FC<MetricViewProps<T>>;
};

type GenericMetricProps = MetricSchemaAndValue & {
  name: string;
  metricId: string;
  postId: number;
};

export const GenericMetric: FC<GenericMetricProps & { edittable: boolean }> = (
  props,
) =>
  props.edittable ? (
    <GenericMetricAdjust {...props} />
  ) : (
    <GenericMetricView {...props} />
  );

const GenericMetricView: FC<GenericMetricProps> = (props) => {
  switch (props.metricType) {
    case "zeroToTen":
      return <zeroToTen.View {...props} />;
    case "richText":
      return <richText.View {...props} />;
    case "checkbox":
      return <checkbox.View {...props} />;
    case "numeric":
      return <>Generic placeholder {props.metricType}</>;
  }
};

export const GenericMetricAdjust: FC<GenericMetricProps> = (props) => {
  const editValue = api.posts.editValue.useMutation();
  type ChangeType = RouterInputs["posts"]["editValue"]["change"];

  const [pendingDelta, setPendingDelta] = useState<Delta | null>(null);
  const hasPendingDelta =
    pendingDelta !== null && (editValue.isIdle || editValue.isSuccess);
  const deltaDelay = useRef<NodeJS.Timeout>();
  const { mutate } = editValue;
  useEffect(() => {
    if (hasPendingDelta) {
      if (deltaDelay.current === undefined) {
        deltaDelay.current = setTimeout(() => {
          setPendingDelta((p) => {
            if (p) {
              mutate({
                metricId: props.metricId,
                postId: props.postId,
                change: { changeset: p.ops },
              });
            }
            return null;
          });
          deltaDelay.current = undefined;
        }, 500);
      }
    }
  }, [hasPendingDelta, props.metricId, props.postId, mutate]);

  useWatchMutation(editValue);

  switch (props.metricType) {
    case "zeroToTen":
      return (
        <zeroToTen.Edit
          {...props}
          onChange={(change) =>
            void editValue.mutate({
              metricId: props.metricId,
              postId: props.postId,
              change,
            })
          }
        />
      );
    case "richText":
      return (
        <richText.Edit
          {...props}
          onChange={(delta) =>
            void setPendingDelta((d) => {
              return (d ?? new Delta()).compose(new Delta(delta?.changeset));
            })
          }
        />
      );

    case "checkbox":
      return (
        <checkbox.Edit
          {...props}
          onChange={(change) =>
            void editValue.mutate({
              metricId: props.metricId,
              postId: props.postId,
              change,
            })
          }
        />
      );
    case "numeric":
      return <>Generic placeholder {props.metricType}</>;
  }
};
