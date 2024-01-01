import Delta from "quill-delta";
import { z } from "zod";

interface MetricMetadata<
  Value extends z.AnyZodObject,
  Change extends z.ZodTypeAny,
  Schema extends z.AnyZodObject,
> {
  schema: Schema;
  value: Value;
  change: Change;
  apply(value: z.infer<Value> | null, change: z.infer<Change>): z.infer<Value> | null;
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
): MetricMetadata<z.ZodObject<{value: Value}>, Value, Schema> {
  return {
    ...m,
    value: z.object({value}),
    change: value,
    apply(value, change) {
      return {value: change};
    },
  };
}

const quillOperation = z.object({
  insert: z.string().or(z.record(z.string(), z.any())).optional(),
  delete: z.number().optional(),
  retain: z.number().or(z.record(z.string(), z.any())).optional(),
  attributes: z.record(z.string(), z.any()).optional(),
});

const schemas = {
  richText: makeSchema({
    schema: z.object({
      headline: z.literal(true).optional(),
    }),
    value: z.object({
      ops: quillOperation.array().optional(),
    }),
    change: z.object({
      changeset: quillOperation.array(),
    }),
    apply: (value, change) => {
      return new Delta(value?.ops).compose(new Delta(change.changeset));
    },
  }),
  zeroToTen: scalarSchema({
    schema: z.object({
      labels: z.string().nullable().array().max(11),
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
  change: z.infer<(typeof schemas)[MetricSchemaName]["change"]>,
  schema: z.infer<(typeof schemas)[MetricSchemaName]["schema"]>,
};

const validateMetricSchema = z.discriminatedUnion("metricType", [
  schemas.richText.schema.extend({ metricType: z.literal("richText") }),
  schemas.zeroToTen.schema.extend({ metricType: z.literal("zeroToTen") }),
  schemas.numeric.schema.extend({ metricType: z.literal("numeric") }),
  schemas.checkbox.schema.extend({ metricType: z.literal("checkbox") }),
]);

const validateMetricValue = z.discriminatedUnion("metricType", [
  z.object({ value: schemas.richText.value, metricType: z.literal("richText") }),
  z.object({ value: schemas.zeroToTen.value, metricType: z.literal("zeroToTen") }),
  z.object({ value: schemas.numeric.value, metricType: z.literal("numeric") }),
  z.object({ value: schemas.checkbox.value, metricType: z.literal("checkbox") }),
]);

const validateGenericMetricValue = z.union([
  schemas.richText.value,
  schemas.zeroToTen.value,
  schemas.numeric.value,
  schemas.checkbox.value,
]);

const validateMetricChange = z.discriminatedUnion("metricType", [
  z.object({ change: schemas.richText.change, metricType: z.literal("richText") }),
  z.object({ change: schemas.zeroToTen.change, metricType: z.literal("zeroToTen") }),
  z.object({ change: schemas.numeric.change, metricType: z.literal("numeric") }),
  z.object({ change: schemas.checkbox.change, metricType: z.literal("checkbox") }),
]);

const validateGenericMetricChange = z.union([
  schemas.richText.change,
  schemas.zeroToTen.change,
  schemas.numeric.change,
  schemas.checkbox.change,
])

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

function updateMetricValue(metricType: MetricType, old: GenericMetricValue | null, change: GenericMetricChange): GenericMetricValue | null {
  const validatedValue = schemas[metricType].value.nullable().parse(old);
  const validatedChange = schemas[metricType].change.parse(change);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  return schemas[metricType].apply(validatedValue as any, validatedChange as never);
}

export const metricSchemas = {
  validateMetricSchemaAndValues,
  validateMetricSchema,
  validateMetricValue,
  validateGenericMetricValue,
  validateMetricChange,
  validateGenericMetricChange,

  updateMetricValue,
}

export type MetricSchemaAndValues = z.infer<typeof validateMetricSchemaAndValues>;
export type MetricSchemaAndValue = z.infer<typeof validateMetricSchemaAndValue>;
export type MetricSchema = z.infer<typeof validateMetricSchema>;
export type GenericMetricValue = z.infer<typeof validateGenericMetricValue>;
export type GenericMetricChange = z.infer<typeof validateGenericMetricChange>;
