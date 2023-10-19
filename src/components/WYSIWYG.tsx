"use client";

import {
  FC,
  MutableRefObject,
  RefObject,
  useMemo,
  useRef,
  useState,
} from "react";

import "react-quill/dist/quill.snow.css";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import { DeltaStatic } from "quill";
import { useSession } from "next-auth/react";

export const ClientImpl_WYSIWYG: FC<{
  defaultValue: DeltaStatic | null;
  onChange: () => void;
  editable: boolean;
  editorRef: MutableRefObject<UnprivilegedEditor|null>;
}> = (props) => {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike", "blockquote"],
        [
          { list: "ordered" },
          { list: "bullet" },
          { indent: "-1" },
          { indent: "+1" },
        ],
        ["link", "image"],
        ["clean"],
      ],
    }),
    [],
  );

  if (!props.editable) {
    return (
      <ReactQuill
        defaultValue={props.defaultValue ?? undefined}
        className="[&_.ql-editor]:border-t-[1px] [&_.ql-editor]:border-[#ccc] [&_.ql-toolbar]:hidden"
        // theme="snow"
        modules={modules}
        readOnly
      />
    );
  }
  return (
    <ReactQuill
      defaultValue={props.defaultValue ?? undefined}
      // theme="snow"
      modules={modules}
      onChange={(value, delta, source, editor) => {
        props.editorRef.current = editor;
        props.onChange();
      }}
    />
  );
};


