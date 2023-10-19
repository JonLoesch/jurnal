import { XMarkIcon } from "@heroicons/react/24/outline";
import { FC, useCallback, useRef, useState } from "react";

export function useToastMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<NodeJS.Timeout>();
  const newToast = useCallback((newMessage: string, durationMS: number) => {
    setMessage(newMessage);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), durationMS);
  }, []);
  const clearToast = useCallback(() => setMessage(null), []);
  return { message, newToast, clearToast };
}

export const Toast: FC<ReturnType<typeof useToastMessage>> = (props) => {
  return (
    <div className="toast">
      {props.message !== null && (
        <>
          <div className="alert bg-indigo-200 p-0 gap-0">
            <span className="p-4 pr-0">{props.message}</span>
            <button onClick={() => props.clearToast()} className="px-4 h-full">
              <XMarkIcon className="h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
