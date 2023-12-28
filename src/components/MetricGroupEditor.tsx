import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AdjustmentsHorizontalIcon,
  ChatBubbleBottomCenterIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import { Prisma, PrismaClient } from "@prisma/client";
import { produce, Draft } from "immer";
import { FC, useCallback, useEffect, useState } from "react";
import { MetricSchema } from "~/lib/metricSchemas";

// type MetricGroup = Prisma.MetricGroupGetPayload<{ include: { metrics: true } }>;
// type Metric = MetricGroup["metrics"][number];

// type MetricGroup = {
//   metrics: Metric[],
//   name: string,
//   description: string,
//   id: number,
// } & ({operation: 'update'} | {operation: 'create'});
// type Metric = {
//   name: string,
//   description: string,
//   id: string,
// } & ({operation: 'update'} | {operation: 'create'});

type Metric = {
  name: string;
  description: string;
  dndID: string;
  schema: MetricSchema;
} & ({ operation: "create" } | { operation: "update"; id: string });
type MetricGroup = {
  metrics: Metric[];
  name: string;
  description: string;
  dndID: string;
} & ({ operation: "create" } | { operation: "update"; id: number });

export const ClientImpl_MetricGroupEditor: FC<{
  metricGroups: MetricGroup[];
  setMetricGroups: (metricGroups: MetricGroup[]) => void;
}> = (props) => {
  const [temporaryDragState, setTemporaryDragState] = useState(
    props.metricGroups,
  );
  useEffect(() => {
    setTemporaryDragState(props.metricGroups);
  }, [props.metricGroups]);

  return (
    <DndContext
      onDragCancel={() => {
        setTemporaryDragState(props.metricGroups);
      }}
      onDragEnd={(e) => {
        update((draft) => {
          if (e.over === null) return;
          const active = getInfo(draft, e.active.id as string);
          const over = getInfo(draft, e.over.id as string);
          if (
            active?.type === "metric" &&
            over?.type === "metric" &&
            active.metricGroup.dndID === over.metricGroup.dndID
          ) {
            active.metricGroup.metrics.splice(
              over.metricIndex,
              0,
              ...active.metricGroup.metrics.splice(active.metricIndex, 1),
            );
          }
        });
      }}
      onDragOver={(e) => {
        if (e.over === null) {
          setTemporaryDragState(props.metricGroups);
        } else {
          setTemporaryDragState(
            produce((draft) => {
              if (e.over === null) return;
              const active = getInfo(draft, e.active.id as string);
              const over = getInfo(draft, e.over.id as string);
              if (
                active?.type === "metric" &&
                over !== null &&
                active.metricGroup.dndID !== over.metricGroup.dndID
              ) {
                active.metricGroup.metrics.splice(active.metricIndex, 1);
                if (over.type === "metric_group") {
                  over.metricGroup.metrics.push(active.metric);
                } else {
                  over.metricGroup.metrics.splice(
                    over.metricIndex,
                    0,
                    active.metric,
                  );
                }
              }
            }),
          );
        }
      }}
    >
      <div className="flex flex-col gap-8">
        {temporaryDragState.map((metricGroup, index) => (
          <MetricGroup
            {...metricGroup}
            key={metricGroup.dndID}
            setMetricGroup={(g) =>
              update((draft) => {
                draft[index]!.name = g.name;
                draft[index]!.description = g.description;
                draft[index]!.metrics = g.metrics;
              })
            }
            deleteMetricGroup={() =>
              update((draft) => {
                draft.splice(index, 1);
              })
            }
          />
        ))}
        <div className="flex flex-row justify-center">
          <div
            className="btn btn-accent btn-outline"
            onClick={() =>
              update((draft) => {
                draft.push({
                  operation: "create",
                  name: "",
                  description: "",
                  dndID: `new_metric_group ${autoInc++}`,
                  metrics: [],
                });
              })
            }
          >
            Add Routine
          </div>
        </div>
      </div>
    </DndContext>
  );
  function update(
    recipe: (draft: Draft<MetricGroup[]>) => MetricGroup[] | undefined | void,
  ) {
    props.setMetricGroups(produce(recipe)(temporaryDragState));
  }
};

let autoInc = 1;

const MetricGroup: FC<
  MetricGroup & {
    setMetricGroup: (
      metricGroup: Pick<MetricGroup, "name" | "description" | "metrics">,
    ) => void;
    deleteMetricGroup: () => void;
  }
> = (props) => {
  const { setNodeRef } = useDroppable({
    id: props.dndID,
  });
  function addMetric(schema: Metric["schema"]) {
    props.setMetricGroup({
      ...props,
      metrics: [
        ...props.metrics,
        {
          operation: "create",
          name: "",
          description: "",
          schema,
          dndID: `new_metric ${autoInc++}`,
        },
      ],
    });
  }
  return (
    <div className="card bg-base-300 shadow-xl" ref={setNodeRef}>
      <div className="card-body">
        <div className="card-title">
          
        <input
          type="text"
          value={props.name}
          className="input input-bordered input-ghost w-48 flex-grow"
          onChange={(e) => props.setMetricGroup({ ...props, name: e.target.value })}
        />
        <textarea
          value={props.description}
          className="textarea textarea-bordered textarea-ghost flex-shrink flex-grow-[2] basis-96 max-md:hidden"
          onChange={(e) =>
            props.setMetricGroup({ ...props, description: e.target.value })
          }
        />
        </div>
        <SortableContext
          items={props.metrics.map((m) => m.dndID)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3 pl-3">
            {props.metrics.map((m, index) => (
              <Metric
                {...m}
                key={m.dndID}
                setMetric={(newMetric) =>
                  props.setMetricGroup({
                    ...props,
                    metrics: [
                      ...props.metrics.slice(0, index),
                      { ...m, ...newMetric },
                      ...props.metrics.slice(index + 1),
                    ],
                  })
                }
                deleteMetric={() =>
                  props.setMetricGroup({
                    ...props,
                    metrics: [
                      ...props.metrics.slice(0, index),
                      ...props.metrics.slice(index + 1),
                    ],
                  })
                }
              />
            ))}
          </div>
        </SortableContext>
        <div className="card-actions mt-4 justify-between">
          <div
            className="btn btn-accent btn-outline"
            onClick={() => addMetric({ metricType: "checkbox" })}
          >
            Add <CheckIcon className="h-4 w-4" />
          </div>
          <div
            className="btn btn-accent btn-outline"
            onClick={() => addMetric({ metricType: "zeroToTen", labels: [] })}
          >
            Add <AdjustmentsHorizontalIcon className="h-4 w-4" />
          </div>
          <div
            className="btn btn-accent btn-outline"
            onClick={() => addMetric({ metricType: "richText" })}
          >
            Add <ChatBubbleBottomCenterIcon className="h-4 w-4" />
          </div>
          <div className="btn btn-error btn-outline" onClick={props.deleteMetricGroup}>
            <TrashIcon className="h-4 w-4" /> routine
          </div>
        </div>
      </div>
    </div>
  );
};

const Metric: FC<
  Metric & {
    setMetric: (
      metric: Pick<Metric, "schema" | "name" | "description">,
    ) => void;
    deleteMetric: () => void;
  }
> = (props) => {
  const { setNodeRef, listeners, attributes, transform, transition } =
    useSortable({
      id: props.dndID,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const Icon: FC =
    props.schema.metricType === "checkbox"
      ? CheckIcon
      : props.schema.metricType === "zeroToTen"
      ? AdjustmentsHorizontalIcon
      : props.schema.metricType === "richText"
      ? ChatBubbleBottomCenterIcon
      : () => undefined;

  return (
    <div ref={setNodeRef} {...attributes} style={style}>
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="mr-2 inline-block h-6 w-6" {...listeners}>
          <Icon />
        </div>
        <input
          type="text"
          value={props.name}
          className="input input-bordered input-ghost w-48 flex-grow"
          onChange={(e) => props.setMetric({ ...props, name: e.target.value })}
        />
        <textarea
          value={props.description}
          className="textarea textarea-bordered textarea-ghost flex-shrink flex-grow-[2] basis-96 max-md:hidden"
          onChange={(e) =>
            props.setMetric({ ...props, description: e.target.value })
          }
        />
        <div
          className="ml-2 h-6 w-6 flex-shrink-0 hover:text-error"
          onClick={props.deleteMetric}
        >
          <TrashIcon />
        </div>
      </div>
    </div>
  );
};

function getInfo(groups: MetricGroup[], dndID: string) {
  for (const metricGroup of groups) {
    if (metricGroup.dndID === dndID) {
      return {
        type: "metric_group" as const,
        metricGroup,
      };
    }
    for (
      let metricIndex = 0;
      metricIndex < metricGroup.metrics.length;
      metricIndex++
    ) {
      const metric = metricGroup.metrics[metricIndex]!;
      if (metric.dndID === dndID) {
        return {
          type: "metric" as const,
          metricIndex,
          metric,
          metricGroup,
        };
      }
    }
  }
  return null;
}
