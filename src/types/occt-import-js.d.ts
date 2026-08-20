declare module "occt-import-js" {
  export interface OcctMesh {
    name: string;
    attributes: {
      position: { array: number[] };
      normal?: { array: number[] };
    };
    index: { array: number[] };
    color?: number[];
  }

  export interface OcctResult {
    success: boolean;
    root: unknown;
    meshes: OcctMesh[];
  }

  export interface OcctModule {
    ReadStepFile(content: Uint8Array, params: object | null): OcctResult;
    ReadIgesFile(content: Uint8Array, params: object | null): OcctResult;
    ReadBrepFile(content: Uint8Array, params: object | null): OcctResult;
  }

  function occtimportjs(options?: {
    locateFile?: (file: string) => string;
  }): Promise<OcctModule>;

  export default occtimportjs;
}
