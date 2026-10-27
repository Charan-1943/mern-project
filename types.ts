export type AssetCategory = "Overlays" | "Timeline accents" | "Callouts";

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  format: string;
  ratio: string;
  duration: string;
  tags: string[];
  accent: string;
  kind: "gradient" | "grid" | "orb" | "wave";
  file?: Blob;
  fileName?: string;
}

export interface MotionSettings {
  title: string;
  subtitle: string;
  strokeColor: string;
  blur: number;
  markerStart: number;
  markerEnd: number;
}

export type ExportStatus =
  | { kind: "idle" }
  | { kind: "rendering"; progress: number; label: string }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };
