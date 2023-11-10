import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useDraggable,
} from "@dnd-kit/core";
import { FC, PropsWithChildren, useReducer, useState } from "react";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  arrayMove,
  rectSwappingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { produce } from "immer";

type MG = {
  name: string;
  metrics: M[];
};
type M = {
  name: string;
  id: number;
};

let autoInc = 0;

const initial: MG[] = [
  {
    name: "Morning",
    metrics: [
      { name: "Slept well", id: autoInc++ },
      { name: "Logistically organized / planned", id: autoInc++ },
      { name: "Physically tidied", id: autoInc++ },
      { name: "Kept up to date with (e-)mail", id: autoInc++ },
    ],
  },
  {
    name: "Night",
    metrics: [
      { name: "Brushed Teeth", id: autoInc++ },
      { name: "Socially active", id: autoInc++ },
      { name: "Was Productive", id: autoInc++ },
      { name: "Ate Well", id: autoInc++ },
      { name: "Excersized", id: autoInc++ },
      { name: "Had a good 30 minutes of no-screen-time before bed", id: autoInc++ },
      { name: "General Mood", id: autoInc++ },
    ],
  },
];

console.log(initial);

const MySortItem: FC<PropsWithChildren<{ id: string }>> = (props) => {
  const { setNodeRef, listeners, transform, transition } = useSortable({
    id: props.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="cursor-grab active:cursor-grabbing"
    >
      {props.children}
    </div>
  );
};

const MyMetric: FC<{ metric: M }> = (props) => {
  return <div>{props.metric.name}</div>;
};

const DndMetricGroup: FC<{ id: string; metricGroup: MG }> = (props) => {
  return (
    <SortableContext
      items={props.metricGroup.metrics.map((m) => `${props.id}.${m.name}`)}
      // strategy={verticalListSortingStrategy}
    >
      <div className="border-2 border-gray-400 p-3">
        <div className="text-xl font-semibold">{props.metricGroup.name}</div>

        {props.metricGroup.metrics.map((m) => (
          <MySortItem id={`${props.id}.${m.name}`} key={m.name}>
            <MyMetric metric={m} />
          </MySortItem>
        ))}
      </div>
    </SortableContext>
  );
};

function useSimpleReducer<T, A>(
  dispatch: (prev: T, action: A) => T,
  initial: T,
) {
  return useReducer(dispatch, initial);
}

export const MetricGroupEditor: FC = () => {
  const [state, setState] = useState(initial);
  const [[mgName, mName], setActive] = useSimpleReducer<
    [string, string] | [null, null],
    string | null
  >(
    (_, action) => {
      if (action === null) return [null, null];
      return splitId(action);
    },
    [null, null],
  );

  function splitId(id: string): [string, string] {
    const [mg, m] = id.split(".");
    if (mg == null) throw new Error();
    if (m == null) throw new Error();
    return [mg, m];
  }

  return (
    <DndContext
      onDragEnd={handleDragEnd}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
    >
      <div className="flex flex-col gap-12">
        {state.map((mg) => (
          <DndMetricGroup key={mg.name} id={mg.name} metricGroup={mg} />
        ))}
      </div>
      {/* <DragOverlay>
        {mgName !== null && (
          <MyMetric
            metric={
              state
                .find((x) => x.name === mgName)!
                .metrics.find((x) => x.name === mName)!
            }
          />
        )}
      </DragOverlay> */}
    </DndContext>
  );

  function handleDragStart(event: DragStartEvent) {
    if (typeof event.active.id === "number") {
      throw new Error();
    }
    // setActive(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (typeof event.active.id === "number") {
      throw new Error();
    }
    if (typeof event.over?.id !== "string") {
      throw new Error();
    }
    const [fromMG, fromM] = splitId(event.active.id);
    const [toMG, toM] = splitId(event.over.id);
    if (fromMG === toMG) {
      setState(produce(x => {
        const mg = x.find(_ => _.name === fromMG)!;
        const oldIndex = mg.metrics.findIndex(_ => _.name === fromM);
        const newIndex = mg.metrics.findIndex(_ => _.name === toM);
        mg.metrics = arrayMove(mg.metrics, oldIndex, newIndex);
      }))
    } else {

      setState(produce(x => {
        const from = x.find(_ => _.name === fromMG)!.metrics;
        const to = x.find(_ => _.name === toMG)!.metrics;
        const removed = from.splice(from.findIndex(_ => _.name === fromM), 1)[0]!;
        to.splice(0, 0, removed);
      }))
    }
    console.log(active, over);
    setActive(null);
  }
};
