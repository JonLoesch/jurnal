import { DeltaStatic } from "quill";

declare global {
    // you can use typical basic types
    // or you can use classes, interfaces, object types, etc.
    namespace PrismaJson {
        type QuillData = DeltaStatic
    }
  }