/**
 * Converts Onshape's FeatureScript evaluation response tree (BTFSValue* nodes)
 * into plain JS values. ValueWithUnits collapse to their SI number (meters,
 * radians…); maps/arrays recurse.
 */

interface FsNode {
  btType?: string;
  value?: unknown;
  message?: FsNode;
  key?: FsNode;
  connections?: FsNode[];
  standardType?: string;
}

export function fsToPlain(node: unknown): unknown {
  if (node === null || node === undefined) return null;
  if (typeof node !== "object") return node;
  const n = node as FsNode;

  switch (true) {
    case n.btType === "com.belmonttech.serialize.fsvalue.BTFSValueUndefined-1948":
      return null;
    case n.btType?.includes("BTFSValueWithUnits") ?? false:
      return typeof n.value === "number" ? n.value : Number(n.value);
    case n.btType?.includes("BTFSValueNumber") ?? false:
    case n.btType?.includes("BTFSValueBoolean") ?? false:
    case n.btType?.includes("BTFSValueString") ?? false:
      return n.value;
    case n.btType?.includes("BTFSValueArray") ?? false:
      return ((n.value as FsNode[]) ?? []).map((entry) =>
        fsToPlain((entry as { message?: unknown }).message ?? entry),
      );
    case n.btType?.includes("BTFSValueMap") ?? false: {
      const out: Record<string, unknown> = {};
      for (const entry of (n.value as FsNode[]) ?? []) {
        const key = fsToPlain((entry.key as { message?: unknown } | undefined)?.message ?? entry.key);
        out[String(key)] = fsToPlain(
          ((entry as { value?: { message?: unknown } }).value as { message?: unknown })?.message ??
            (entry as { value?: unknown }).value,
        );
      }
      return out;
    }
    default: {
      // unknown wrapper — unwrap common {message: ...} shells
      if (n.message) return fsToPlain(n.message);
      if (n.value !== undefined) return fsToPlain(n.value);
      return null;
    }
  }
}
