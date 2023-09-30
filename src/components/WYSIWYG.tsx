"use client";

import { FC, useMemo, useRef, useState } from "react";

import "react-quill/dist/quill.snow.css";
import ReactQuill from "react-quill";
import { DeltaStatic } from "quill";
import { useSession } from "next-auth/react";

// eslint-disable-next-line @typescript-eslint/ban-types
export const WYSIWYG: FC<{
  defaultValue?: DeltaStatic;
  onChange: (fetchNewValue: () => DeltaStatic | undefined) => void;
}> = (props) => {
  const quillRef = useRef<ReactQuill>(null);
  const session = useSession();

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

  if (!session.data?.user.isPoster) {
    console.log(props.defaultValue);
    return (
      <ReactQuill
        defaultValue={props.defaultValue}
        className="[&_.ql-editor_p]:post [&_.ql-editor]:border-t-[1px] [&_.ql-editor]:border-[#ccc] [&_.ql-toolbar]:hidden"
        theme='snow'
        modules={modules}
        readOnly
      />
    );
  }
  return (
    <ReactQuill
      defaultValue={props.defaultValue}
      className="[&_.ql-editor_p]:post"
      theme="snow"
      ref={quillRef}
      modules={modules}
      onChange={() => {
        props.onChange(() => quillRef.current?.getEditor().getContents());
      }}
    />
  );
};
