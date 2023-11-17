import { DeltaStatic } from "quill";
import { MetricSchema } from "./metricSchemas";

declare global {
    // you can use typical basic types
    // or you can use classes, interfaces, object types, etc.
    namespace PrismaJson {
        type QuillData = DeltaStatic
        type GenericMetricSchema = MetricSchema
    }
  }