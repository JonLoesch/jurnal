"use client";

import {
  FC,
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import "react-quill/dist/quill.snow.css";
import ReactQuill, { UnprivilegedEditor } from "react-quill";
import Quill, { DeltaStatic, TextChangeHandler } from "quill";
import { useSession } from "next-auth/react";
import Delta, { Op } from "quill-delta";

export const ClientImpl_WYSIWYG: FC<{
  defaultValue: { ops?: Op[] } | null;
  onChange?: (delta: Delta) => void;
  editable: boolean;
  editorRef?: MutableRefObject<Quill | null>;
}> = (props) => {
  const elemRef = useRef<HTMLDivElement | null>(null);
  const [quill, setQuill] = useState<Quill | null>(null);
  useEffect(() => {
    setQuill((q) => {
      if (!q) {
        q =
          elemRef.current !== null
            ? new Quill(elemRef.current, {
                theme: "snow",
                modules: {
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
                },
              })
            : null;
            if (props.editorRef) {
              props.editorRef.current = q;
            }
        q?.setContents(props.defaultValue as DeltaStatic);
      }
      return q;
    });
  }, [props.defaultValue, props.editorRef]);

  useEffect(() => {
    if (props.editable) {
      quill?.enable();
    } else {
      quill?.disable();
    }
  }, [quill, props.editable]);

  const { onChange } = props;
  const onTextChange = useCallback<TextChangeHandler>(
    (ev) => {
      onChange?.(ev as unknown as Delta);
    },
    [onChange],
  );

  useEffect(() => {
    if (quill) {
      quill.on("text-change", onTextChange);
      return () => void quill.off("text-change", onTextChange);
    }
  }, [quill, onTextChange]);

  return (
    <div
      className={
        props.editable
          ? ""
          : "[&_.ql-editor]:border-t-[1px] [&_.ql-editor]:border-[#ccc] [&_.ql-toolbar]:hidden"
      }
    >
      <div ref={elemRef}></div>
    </div>
  );
};
