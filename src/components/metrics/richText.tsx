import { type MetricUI } from ".";
import { WYSIWYG } from "../dynamic";

export const richText: MetricUI<"richText"> = {
  Edit(props) {
    return (
      <WYSIWYG
        editable
        defaultValue={props.value}
        onChange={(delta) => {
          props.onChange({changeset: delta.ops});
        }}
      />
    );
  },
  View(props) {
    return null;
  },
};
