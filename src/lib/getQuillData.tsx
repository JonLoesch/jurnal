"use client";
import { RefObject } from "react";
import ReactQuill from "react-quill";


export function getQuillData(quillRef: RefObject<ReactQuill>) {
  return {
    full: quillRef.current?.getEditor().getContents() ?? null,
    firstLine: quillRef.current?.getEditor().getText().replace(/\n.*$/s, "") ?? null,
  };
}
