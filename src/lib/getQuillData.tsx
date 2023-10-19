"use client";
import { RefObject } from "react";
import ReactQuill, { UnprivilegedEditor } from "react-quill";


export function getQuillData(editorRef: RefObject<UnprivilegedEditor>) {
  return {
    full: editorRef.current?.getContents() ?? null,
    firstLine: editorRef.current?.getText().replace(/\n.*$/s, "") ?? null,
  };
}
