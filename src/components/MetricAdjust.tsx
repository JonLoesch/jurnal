import { FC } from "react";
import { z } from "zod";

export const MetricAdjust: FC<{
  name: string;
  metricKey: string;
  value?: number;
  onChange: (value: number | undefined) => void;
}> = (props) => {
  return (
    <>
      <div>
        <label
          htmlFor={`metric-${props.metricKey}`}
          className="mb-2 inline-block text-neutral-700 dark:text-neutral-200"
        >
          {props.name}
        </label>
        <input
            id={`metric-${props.metricKey}`}
          type="range"
          className="transparent h-[4px] w-full cursor-pointer appearance-none border-transparent bg-neutral-200 dark:bg-neutral-600"
          min={0}
          max={10}
          value={props.value}
          onChange={(e) => props.onChange(z.coerce.number().parse(e.target.value))}
        />
      </div>
    </>
  );
};
