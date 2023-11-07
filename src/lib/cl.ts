type Classes = string | [Classes] | Record<string, boolean> | null;

export function cl(...classes: Classes[]): string {
    const result = {r: ''};
    classes.forEach(v => appendClass(v, result));
    return result.r;
}

function appendClass(classes: Classes, result: { r: string }) {
  if (typeof classes === "string") {
    result.r = `${result.r} ${classes}`;
  } else if (Array.isArray(classes)) {
    classes.forEach(v => appendClass(v, result));
  } else if (classes !== null) {
    Object.entries(classes).forEach(([key, enabled]) => {
        if (enabled) {
            appendClass(key, result);
        }
    })
  }
}
