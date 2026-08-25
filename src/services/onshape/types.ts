/** Wire types shared by the Onshape panel and its API routes. */

export interface OnshapeDocContext {
  documentId: string;
  /** workspace or version — from the extension URL's {$workspaceOrVersion} */
  wvm: "w" | "v";
  wvmId: string;
  elementId: string;
}

export interface StudioPart {
  partId: string;
  name: string;
  material: string | null;
}

/** Panel bootstrap: names for auto-fill + the studio's parts. */
export interface StudioContextResponse {
  documentName: string;
  elementName: string;
  parts: StudioPart[];
}

export interface PlanarFace {
  faceId: string;
  /** 2D bbox of the face, inches */
  width: number;
  height: number;
  /** face area, square inches */
  area: number;
}

export interface FacesResponse {
  faces: PlanarFace[];
}

export interface DxfExportResponse {
  /** DXF text, inches */
  dxf: string;
  envelope: { width: number; height: number };
}

export interface ResolveFaceResponse {
  /** deterministic id of the part owning the face, or null */
  partId: string | null;
}

/** Result of the "is this Onshape part already in BearParts?" lookup. */
export interface LinkedPartResponse {
  linked: {
    libraryPartId: string;
    name: string;
    latestVersion: number;
    folderName: string | null;
    queue: { id: string; status: string; quantity: number }[];
  } | null;
}

export interface StatusResponse {
  configured: boolean;
  mock: boolean;
  /** user has an Onshape OAuth connection */
  connected: boolean;
}
