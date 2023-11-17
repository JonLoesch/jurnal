import { ifElse } from "~/lib/ifElse";
import { type MetricUI } from ".";
import { z } from "zod";
import { CSSProperties, Reducer, useReducer, useState } from "react";
import { XCircleIcon } from "@heroicons/react/24/outline";

export const zeroToTen: MetricUI<"zeroToTen"> = {
  edit(props) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [v, setV] = useReducer<Reducer<number | null, number | null>>((prevValue, newValue) => {
        props.onChange(newValue !== null ? {value: newValue} : null);
        return newValue;
    }, props.value?.value ?? null);
    return (
        <>
          <div className="flex items-center">
            <div className="basis-full">
              <label
                htmlFor={`metric-${props.metricId}`}
                className="mb-2 inline-block text-neutral-700 dark:text-neutral-200"
              >
                {props.name}
              </label>
              <input
                id={`metric-${props.metricId}`}
                type="range"
                className="range w-full"
                min={0}
                max={10}
                value={v ?? 0}
                onChange={(e) =>
                    setV(z.coerce.number().parse(e.target.value))
                }
                style={
                  {
                    "--range-shdw": greenToRed((v ?? 0) / 10),
                  } as CSSProperties
                }
              />
              <div className="flex w-full justify-between px-1 text-xs">
                {Array(11)
                  .fill(0)
                  .map((_, idx) => (
                    <span key={idx}>|</span>
                  ))}
              </div>
            </div>
            <div className="basis-8">
              {v !== null && (
                <XCircleIcon onClick={() => setV(null)} className='cursor-pointer' />
              )}
            </div>
          </div>
        </>
      );
  },
  view(props) {
    return (
      <div className="flex h-10 justify-between rounded-full">
        <span>{props.name}:</span>
        <span
          style={{
            backgroundColor:
              props.value !== null
                ? `hsl(${greenToRed(props.value.value / 10)})`
                : "transparent",
          }}
          className="h-6 rounded-full px-3"
        >
          {props.value === null ? "null" : `${props.value.value} / 10`}
        </span>
      </div>
    );
  },
};

function greenToRed(v: number): string {
  return `${(120 * v).toFixed(0)} ${(100 * (1 - v * (1 - v))).toFixed(0)}% ${
    50 - 20 * v
  }%`;
}
