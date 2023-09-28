"use client";

import { FC, useState } from "react";
import { Editor } from "react-draft-wysiwyg";

import { EditorState, convertToRaw } from "draft-js";

import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";

// eslint-disable-next-line @typescript-eslint/ban-types
export const WYSIWYG: FC<{}> = (props) => {
  const [editorState, setEditorState] = useState<EditorState>(() =>
    EditorState.createEmpty(),
  );
  console.log(JSON.stringify(convertToRaw(editorState.getCurrentContent())));
  return (
    <Editor editorState={editorState} onEditorStateChange={setEditorState} />
  );
};
