import { DndContext, useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Prisma, PrismaClient } from "@prisma/client";
import { produce } from "immer";
import { FC, useEffect, useState } from "react";

type MetricGroup = Prisma.MetricGroupGetPayload<{ include: { metrics: true } }>;
type Metric = MetricGroup["metrics"][number];

export const MetricGroupEditor: FC<{ metricGroups: MetricGroup[], setMetricGroups: (metricGroups: MetricGroup[]) => void }> = (
  props,
) => {
  const [temporaryDragState, setTemporaryDragState] = useState(props.metricGroups);
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
              active.metricGroup.id === over.metricGroup.id
            ) {
              active.metricGroup.metrics.splice(
                over.metricIndex,
                0,
                ...active.metricGroup.metrics.splice(active.metricIndex, 1),
              );
            }
          })(temporaryDragState)
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
                active.metricGroup.id !== over.metricGroup.id
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
        <MetricGroup {...metricGroup} key={metricGroup.id} />
      ))}
    </DndContext>
  );
};

const MetricGroup: FC<MetricGroup> = props => {
  const { setNodeRef } = useDroppable({ id: dragAndDropIdentifier.metricGroup(props) });
  return (
    <div className="border-2 my-8" ref={setNodeRef}>
      <div className="border-b-2">{props.name}</div>
      <SortableContext
        items={props.metrics.map(dragAndDropIdentifier.metric)}
        strategy={verticalListSortingStrategy}
      >
        {props.metrics.map((m) => (
          <Metric {...m} key={m.id} />
        ))}
      </SortableContext>
    </div>
  );
}

const Metric: FC<Metric> = (props) => {
  const { setNodeRef, listeners, attributes, transform, transition } =
    useSortable({
      id: dragAndDropIdentifier.metric(props),
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

const dragAndDropIdentifier = {
  metricGroup(this: void, mg: MetricGroup) {
    return `metric_group ${mg.id}`;
  },
  metric(this: void, m: Metric) {
    return `metric ${m.id}`;
  },
};

function getInfo(groups: MetricGroup[], dndID: string) {
  for (const metricGroup of groups) {
    if (dragAndDropIdentifier.metricGroup(metricGroup) === dndID) {
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
      if (dragAndDropIdentifier.metric(metric) === dndID) {
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
