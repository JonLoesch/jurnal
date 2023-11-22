import { createContext, useContext, useEffect, useState } from "react";
import { type UseMutationResult } from "@tanstack/react-query";

class Condition {
  private outstanding: Record<number, true> = {};
  private unique = 0;

  public active() {
    for (const _ in this.outstanding) {
      return true;
    }
    return false;
  }

  public trigger(): () => void {
    const id = this.unique++;
    const preActive = this.active();
    this.outstanding[id] = true;
    if (!preActive) {
      this.notify(true);
    }
    return () => {
      delete this.outstanding[id];
      if (!this.active()) {
        this.notify(false);
      }
    };
  }

  private notify(active: boolean) {
    for (const w of Object.values(this.watches)) {
      w(active);
    }
  }
  private readonly watches: Record<number, (active: boolean) => void> = {};
  public subscribe(watch: (active: boolean) => void): () => void {
    const id = this.unique++;
    this.watches[id] = watch;
    return () => delete this.watches[id];
  }
}

export function useCondition(c: Condition): boolean {
  const [state, setState] = useState(c.active());
  useEffect(() => {
    return c.subscribe(setState);
  }, [c]);
  return state;
}

const ctx = createContext({
  apiErrored: new Condition(),
  apiLoadingOverTwoSeconds: new Condition(),
});

export function useApiConditions() {
  return useContext(ctx);
}

export function useWatchMutation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { isError, isLoading }: Pick<UseMutationResult<any, any, any, any>, 'isError' | 'isLoading'>,
) {
  const { apiErrored, apiLoadingOverTwoSeconds } = useApiConditions();
  useEffect(() => {
    if (!isError) return () => undefined;
    return apiErrored.trigger();
  }, [isError, apiErrored]);
  useEffect(() => {
    if (!isLoading) return () => undefined;
    let cancel: () => void = () => clearTimeout(t);
    const t = setTimeout(() => {
        cancel = apiLoadingOverTwoSeconds.trigger();
    }, 2000);
    return () => cancel();
  }, [isLoading, apiLoadingOverTwoSeconds]);
}
