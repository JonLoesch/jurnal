import { Metric } from "~/lib/metricSchemas";
import { MetricUI } from ".";
import { useRef } from "react";

export const checkbox: MetricUI<"checkbox"> = {
  Edit(props) {
    const v = useRef(props.value?.value);
    return (
      <input
        id={`metric-${props.metricId}`}
        type="checkbox"
        className="checkbox"
        checked={v.current}
        onChange={(e) => {
          const checked = e.target.checked;
          props.onChange(checked);
          v.current = checked;
        }}
      />
    );
  },
  View(props) {
    return (
      <input
        id={`metric-${props.metricId}`}
        type="checkbox"
        className="checkbox cursor-default"
        checked={props.value?.value}
        readOnly
      />
    );
  },
};
