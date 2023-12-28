import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Prisma, PrismaClient } from "@prisma/client";
import { produce } from "immer";
import { FC, useEffect, useState } from "react";
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
} & (
  | { operation: "create"; schema: MetricSchema }
  | { operation: "update"; id: string }
);
type MetricGroup = {
  metrics: Metric[];
  name: string;
  description: string;
  dndID: string,
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
        props.setMetricGroups(
          produce((draft: MetricGroup[]) => {
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
          })(temporaryDragState),
        );
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
      {temporaryDragState.map((metricGroup) => (
        <MetricGroup {...metricGroup} key={metricGroup.dndID} />
      ))}
    </DndContext>
  );
};

const MetricGroup: FC<MetricGroup> = (props) => {
  const { setNodeRef } = useDroppable({
    id: props.dndID,
  });
  return (
    <div className="my-8 border-2" ref={setNodeRef}>
      <div className="border-b-2">{props.name}</div>
      <SortableContext
        items={props.metrics.map(m => m.dndID)}
        strategy={verticalListSortingStrategy}
      >
        {props.metrics.map((m) => (
          <Metric {...m} key={m.dndID} />
        ))}
      </SortableContext>
    </div>
  );
};

const Metric: FC<Metric> = (props) => {
  const { setNodeRef, listeners, attributes, transform, transition } =
    useSortable({
      id: props.dndID,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
      {props.name}
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
