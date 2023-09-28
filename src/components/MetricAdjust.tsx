import { XCircleIcon } from "@heroicons/react/24/outline";
import { FC } from "react";
import { z } from "zod";

export const MetricAdjust: FC<{
  name: string;
  metricKey: string;
  value: number | null;
  onChange: (value: number | null) => void;
}> = (props) => {
  return (
    <>
    <div className='flex items-center'>
      <div className = 'basis-full'>
        <label
          htmlFor={`metric-${props.metricKey}`}
          className="mb-2 inline-block text-neutral-700 dark:text-neutral-200"
        >
          {props.name}
        </label>
        <input
          id={`metric-${props.metricKey}`}
          type="range"
          className="range w-full"
          min={0}
          max={10}
          value={props.value ?? 0}
          onChange={(e) =>
            props.onChange(z.coerce.number().parse(e.target.value))
          }
        />
        <div className="flex w-full justify-between px-1 text-xs">
          {Array(11).fill(0).map((_, idx) => (
            <span key={idx}>|</span>
          ))}
        </div>
      </div>
      <div className='basis-8'>
        {props.value !== null && (
          <XCircleIcon onClick={() => props.onChange(null)}/>
        )}
      </div>
      
      </div>
    </>
  );
};
