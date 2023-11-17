import { Delta, DeltaOperation, DeltaStatic } from "quill";
import { z } from "zod";

interface MetricMetadata<
  Value extends z.AnyZodObject,
  Change extends z.ZodTypeAny,
  Schema extends z.AnyZodObject,
> {
  schema: Schema;
  value: Value;
  change: Change;
  apply(value: z.infer<Value>, change: z.infer<Change>): z.infer<Value>;
}

function makeSchema<
  Value extends z.AnyZodObject,
  Change extends z.ZodTypeAny,
  Schema extends z.AnyZodObject,
>(m: MetricMetadata<Value, Change, Schema>) {
  return m;
}
function scalarSchema<
  Value extends z.ZodTypeAny,
  Schema extends z.AnyZodObject,
>(
  {value, ...m}: {
    schema: Schema,
    value: Value,
  }
): MetricMetadata<z.ZodObject<{value: Value}>, z.ZodObject<{value: Value}>, Schema> {
  return {
    ...m,
    value: z.object({value}),
    change: z.object({value}),
    apply(value, change) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return change;
    },
  };
}

const quillOperation = z.object({
  insert: z.any().optional(),
  delete: z.number().optional(),
  retain: z.number().optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

const schemas = {
  richText: makeSchema({
    schema: z.object({}),
    value: z.object({
      ops: quillOperation.array().optional(),
    }),
    change: z.object({
      changeset: quillOperation.array().array(),
    }),
    apply: (value, change) => {
      return change.changeset.reduce(
        (delta, ch) => delta.compose(new Delta(ch)),
        new Delta(value.ops),
      );
    },
  }),
  zeroToTen: scalarSchema({
    schema: z.object({
      labels: z.string().optional().array().max(11),
    }),
    value: z.number().int().min(0).max(10),
  }),
  numeric: scalarSchema({
    schema: z.object({ units: z.string() }),
    value: z.number(),
  }),
  checkbox: scalarSchema({
    schema: z.object({}),
    value: z.boolean(),
  }),
} satisfies Record<
  string,
  MetricMetadata<z.AnyZodObject, z.ZodTypeAny, z.AnyZodObject>
>;

export type MetricType = keyof typeof schemas;
export type Metric<MetricSchemaName extends MetricType> =
{
  value: z.infer<(typeof schemas)[MetricSchemaName]["value"]> | null,
  change: z.infer<(typeof schemas)[MetricSchemaName]["change"]> | null,
  schema: z.infer<(typeof schemas)[MetricSchemaName]["schema"]>,
};

const validateMetricSchema = z.discriminatedUnion("metricType", [
  schemas.richText.schema.extend({ metricType: z.literal("richText") }),
  schemas.zeroToTen.schema.extend({ metricType: z.literal("zeroToTen") }),
  schemas.numeric.schema.extend({ metricType: z.literal("numeric") }),
  schemas.checkbox.schema.extend({ metricType: z.literal("checkbox") }),
]);

const validateMetricValue = z.discriminatedUnion("metricType", [
  z.object({ value: schemas.richText.value.nullable(), metricType: z.literal("richText") }),
  z.object({ value: schemas.zeroToTen.value.nullable(), metricType: z.literal("zeroToTen") }),
  z.object({ value: schemas.numeric.value.nullable(), metricType: z.literal("numeric") }),
  z.object({ value: schemas.checkbox.value.nullable(), metricType: z.literal("checkbox") }),
]);

const validateMetricSchemaAndValue = z.discriminatedUnion("metricType", [
  z.object({ value: schemas.richText.value.nullable(), schema: schemas.richText.schema, metricType: z.literal("richText") }),
  z.object({ value: schemas.zeroToTen.value.nullable(), schema: schemas.zeroToTen.schema, metricType: z.literal("zeroToTen") }),
  z.object({ value: schemas.numeric.value.nullable(), schema: schemas.numeric.schema, metricType: z.literal("numeric") }),
  z.object({ value: schemas.checkbox.value.nullable(), schema: schemas.checkbox.schema, metricType: z.literal("checkbox") }),
]);

const validateMetricSchemaAndValues = z.discriminatedUnion("metricType", [
  z.object({ values: schemas.richText.value.nullable().array(), schema: schemas.richText.schema, metricType: z.literal("richText") }),
  z.object({ values: schemas.zeroToTen.value.nullable().array(), schema: schemas.zeroToTen.schema, metricType: z.literal("zeroToTen") }),
  z.object({ values: schemas.numeric.value.nullable().array(), schema: schemas.numeric.schema, metricType: z.literal("numeric") }),
  z.object({ values: schemas.checkbox.value.nullable().array(), schema: schemas.checkbox.schema, metricType: z.literal("checkbox") }),
]);

export const metricSchemas = {
  validateMetricSchemaAndValues,
}

export type MetricSchemaAndValues = z.infer<typeof validateMetricSchemaAndValues>;
export type MetricSchemaAndValue = z.infer<typeof validateMetricSchemaAndValue>;
export type MetricSchema = z.infer<typeof validateMetricSchema>;

// // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
// let qValue: z.infer<typeof qZod> = null as any;
// // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
// let delValue: { ops: DeltaOperation[] } = null as any;
// qValue = delValue;
// delValue = qValue;

// type MSchema2 = {
//   [K in keyof typeof Validators]: {
//     metricType: K;
//   } & z.infer<(typeof Validators)[K]["schema"]>;
// };
// type MValue2 = {
//   [K in keyof typeof Validators]: {
//     metricType: K;
//     value: z.infer<(typeof Validators)[K]["value"]>;
//   };
// };

// type MSchema =
//   | {
//       metricType: "zeroToTen";
//       labels: (string | null)[];
//     }
//   | {
//       metricType: "numeric";
//       label: string;
//     }
//   | {
//       metric: "checkbox";
//     };

// type MValue =
//   | {
//       metricType: "rich_text";
//       value: DeltaStatic | null;
//     }
//   | {
//       metricType: "zeroToTen";
//       value: number;
//     }
//   | {
//       metricType: "numeric";
//       value: number;
//     }
//   | {
//       metricType: "checkbox";
//       value: boolean;
//     };

// const schema: MSchema = { metricType: "numeric", label: "kg" };
// const value: Omit<MValue, "metricType"> = { value: 277 };

// const combined: MValue = { ...value, metricType: schema.metricType } as MValue;
