
import React from 'react';
export function ifElse<T>(predicate: T | null | undefined | false, yes: (x: T) => React.ReactNode, no: () => React.ReactNode): React.ReactNode {
    return predicate ? yes(predicate) : no();
}