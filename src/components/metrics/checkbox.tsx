import { Metric } from "~/lib/metricSchemas";
import { MetricUI } from ".";
import { useEffect, useRef, useState } from "react";

export const checkbox: MetricUI<"checkbox"> = {
  Edit(props) {
    const v = useRef(props.value?.value);
    const [state, setState] = useState(props.value?.value)
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
      if (ref.current) {
        ref.current.indeterminate = (state === undefined);
      }
    }, [state]);
    return (
      <input
        ref={ref}
        id={`metric-${props.metricId}`}
        type="checkbox"
        className="checkbox indeterminate:checkbox-warning"
        checked={state}
        onChange={(e) => {
          const checked = e.target.checked;
          props.onChange(checked);
          setState(checked);
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
