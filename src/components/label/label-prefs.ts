import { DEFAULT_LABEL_SIZE, isLabelSizeKey, type LabelSizeKey } from "@/services/label/config";

export type LabelLink = "ble" | "usb";

export interface LabelPrefs {
  link: LabelLink;
  size: LabelSizeKey;
}

const KEY = "bearparts.label-printer";
const DEFAULTS: LabelPrefs = { link: "ble", size: DEFAULT_LABEL_SIZE };

/** Last link + label size on this device. Storage can be missing or throw (private mode). */
export function loadLabelPrefs(): LabelPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<keyof LabelPrefs, unknown>>;
    return {
      link: raw.link === "usb" || raw.link === "ble" ? raw.link : DEFAULTS.link,
      size: isLabelSizeKey(raw.size) ? raw.size : DEFAULTS.size,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveLabelPrefs(prefs: LabelPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // not worth bothering anyone about
  }
}
