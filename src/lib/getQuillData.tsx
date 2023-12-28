"use client";
import Quill from "quill";
import { RefObject } from "react";
import ReactQuill, { UnprivilegedEditor } from "react-quill";


export function getQuillData(editorRef: RefObject<Quill>) {
  return {
    full: editorRef.current?.getContents(),
    firstLine: editorRef.current?.getText().replace(/\n.*$/s, ""),
  };
}
