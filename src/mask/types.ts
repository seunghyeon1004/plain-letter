/** Kinds of personal detail that Plain Letter hides before anything leaves the device. */
export const ENTITY_TYPES = ["NAME", "ADDRESS", "DOB", "IDNUM", "PHONE", "EMAIL"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Where a detection came from. Shown to the user in the review step. */
export type DetectionSource = "pattern" | "device" | "user";

export interface Span {
  start: number;
  end: number; // exclusive
  type: EntityType;
  source: DetectionSource;
}

export interface MaskEntry {
  token: string;
  type: EntityType;
  value: string;
  source: DetectionSource;
  count: number;
}

export interface MaskResult {
  masked: string;
  entries: MaskEntry[];
  /** token -> original value */
  map: Record<string, string>;
}

export const ENTITY_LABEL: Record<EntityType, string> = {
  NAME: "Name",
  ADDRESS: "Address",
  DOB: "Date of birth",
  IDNUM: "Account / case / reference number",
  PHONE: "Phone",
  EMAIL: "Email",
};
