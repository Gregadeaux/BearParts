import { cachedCompute, onshapeCachedJson, onshapeFetch, onshapeJson } from "./client";
import { fsToPlain } from "./fs-value";
import { FACE_EXPORT_SCRIPT, faceExportToDxf, type FaceExportPlain } from "./face-export";
import type {
  DxfExportResponse,
  FacesResponse,
  OnshapeDocContext,
  ResolveFaceResponse,
  StudioContextResponse,
} from "./types";

/**
 * Real Onshape REST implementation. Onshape enforces per-endpoint rate limits
 * AND annual per-user call caps, so every read is cached (client.ts) and all
 * geometry work is batched into single FeatureScript evaluations.
 */

const wvmPath = (ctx: OnshapeDocContext) => `/d/${ctx.documentId}/${ctx.wvm}/${ctx.wvmId}`;
const ctxPath = (ctx: OnshapeDocContext) =>
  `${wvmPath(ctx)}/e/${encodeURIComponent(ctx.elementId)}`;

const MIN_5 = 5 * 60 * 1000;
const MIN_30 = 30 * 60 * 1000;

interface PartInfo {
  partId: string;
  name: string;
  material?: { displayName?: string };
}

export async function studioContext(
  accessToken: string,
  ctx: OnshapeDocContext,
): Promise<StudioContextResponse> {
  const [doc, elements, parts] = await Promise.all([
    // names change rarely — cache long
    onshapeCachedJson<{ name?: string }>(accessToken, `/documents/${ctx.documentId}`, {
      ttl: MIN_30,
    }),
    onshapeCachedJson<{ name?: string; id?: string }[]>(
      accessToken,
      `/documents${wvmPath(ctx)}/elements?elementId=${encodeURIComponent(ctx.elementId)}`,
      { ttl: MIN_30 },
    ),
    onshapeCachedJson<PartInfo[]>(
      accessToken,
      `/parts${ctxPath(ctx)}?includePropertyDefaults=false&withThumbnails=false`,
      { ttl: MIN_5 },
    ),
  ]);

  return {
    documentName: doc.name ?? "Onshape document",
    elementName: elements[0]?.name ?? "Part Studio",
    parts: parts.map((p) => ({
      partId: p.partId,
      name: p.name,
      material: p.material?.displayName ?? null,
    })),
  };
}

const FACE_LIST_SCRIPT = `function(context is Context, queries)
{
    var part = queries.part is array ? qUnion(queries.part) : queries.part;
    var faces = evaluateQuery(context, qGeometry(qOwnedByBody(part, EntityType.FACE), GeometryType.PLANE));
    var out = [];
    for (var face in faces)
    {
        var plane = evFaceTangentPlane(context, { "face" : face, "parameter" : vector(0.5, 0.5) });
        var bb = evBox3d(context, { "topology" : face, "tight" : true, "cSys" : coordSystem(plane) });
        out = append(out, {
            "id" : transientQueriesToStrings([face])[0],
            "w" : bb.maxCorner[0] - bb.minCorner[0],
            "h" : bb.maxCorner[1] - bb.minCorner[1],
            "area" : evArea(context, { "entities" : face })
        });
    }
    return out;
}`;

const M_TO_IN = 1 / 0.0254;
const M2_TO_IN2 = M_TO_IN * M_TO_IN;

interface EvalResponse {
  result: unknown;
  notices?: { message?: string }[];
}

async function evalFeatureScript(
  accessToken: string,
  ctx: OnshapeDocContext,
  script: string,
  queries: Record<string, string[]>,
  cacheKey?: string,
): Promise<unknown> {
  const run = async () => {
    const res = await onshapeJson<EvalResponse>(
      accessToken,
      `/partstudios${ctxPath(ctx)}/featurescript?rollbackBarIndex=-1`,
      { method: "POST", body: JSON.stringify({ script, queries }) },
    );
    // script errors come back as HTTP 200 with a null result — throw so the
    // failure is never cached
    if (res.result === null || res.result === undefined) {
      const notice = res.notices?.map((n) => n.message).filter(Boolean).join("; ");
      throw new Error(`Onshape geometry query failed${notice ? `: ${notice}` : ""}`);
    }
    return fsToPlain(res.result);
  };
  return cacheKey ? cachedCompute(cacheKey, MIN_5, run) : run();
}

export async function planarFaces(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
): Promise<FacesResponse> {
  const plain = (await evalFeatureScript(
    accessToken,
    ctx,
    FACE_LIST_SCRIPT,
    { part: [partId] },
    `faces:${ctxPath(ctx)}:${partId}`,
  )) as { id: string; w: number; h: number; area: number }[];

  const faces = (plain ?? [])
    .map((f) => ({
      faceId: f.id,
      width: f.w * M_TO_IN,
      height: f.h * M_TO_IN,
      area: f.area * M2_TO_IN2,
    }))
    .sort((a, b) => b.area - a.area)
    .slice(0, 40);
  return { faces };
}

// NOTE: the eval endpoint hands `queries.<name>` over as a ready-made Query
// (a map), NOT an array — qUnion() on it fails with a signature error.
const RESOLVE_FACE_SCRIPT = `function(context is Context, queries)
{
    var face = queries.face is array ? qUnion(queries.face) : queries.face;
    var owners = evaluateQuery(context, qOwnerBody(face));
    return { "partId" : size(owners) > 0 ? transientQueriesToStrings(owners)[0] : "" };
}`;

/** Which part owns this face? (Onshape SELECTION events only carry the face.) */
export async function resolveFacePart(
  accessToken: string,
  ctx: OnshapeDocContext,
  faceId: string,
  microversion: string | null,
): Promise<ResolveFaceResponse> {
  const plain = (await evalFeatureScript(
    accessToken,
    ctx,
    RESOLVE_FACE_SCRIPT,
    { face: [faceId] },
    `owner:${ctxPath(ctx)}:${faceId}:${microversion ?? ""}`,
  )) as { partId?: string };
  return { partId: plain.partId || null };
}

export async function exportFaceDxf(
  accessToken: string,
  ctx: OnshapeDocContext,
  _partId: string,
  faceId: string,
): Promise<DxfExportResponse> {
  const plain = (await evalFeatureScript(
    accessToken,
    ctx,
    FACE_EXPORT_SCRIPT,
    { face: [faceId] },
    `dxf:${ctxPath(ctx)}:${faceId}`,
  )) as FaceExportPlain;
  return faceExportToDxf(plain);
}

export async function shadedViewPng(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
): Promise<Uint8Array> {
  const path =
    `/parts${ctxPath(ctx)}/partid/${encodeURIComponent(partId)}/shadedviews` +
    `?outputWidth=256&outputHeight=256&pixelSize=0&edges=show&useAntiAliasing=true`;
  const res = await onshapeCachedJson<{ images: string[] }>(accessToken, path, { ttl: MIN_5 });
  const b64 = res.images?.[0];
  if (!b64) throw new Error("Onshape returned no preview image");
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

/** Backoff schedule for translation polling — docs say ~1/sec max, back off. */
const POLL_DELAYS_MS = [800, 1000, 1500, 2000, 3000, 4000, 5000, 5000, 5000, 8000, 8000, 10000];

export async function exportStep(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
): Promise<Uint8Array> {
  const created = await onshapeJson<{ id: string }>(
    accessToken,
    `/partstudios${ctxPath(ctx)}/translations`,
    {
      method: "POST",
      body: JSON.stringify({
        formatName: "STEP",
        partIds: partId,
        storeInDocument: false,
        stepVersionString: "AP242",
      }),
    },
  );

  let externalDataId: string | null = null;
  for (const delay of POLL_DELAYS_MS) {
    await new Promise((r) => setTimeout(r, delay));
    const status = await onshapeJson<{
      requestState: string;
      failureReason?: string;
      resultExternalDataIds?: string[];
    }>(accessToken, `/translations/${created.id}`);
    if (status.requestState === "DONE") {
      externalDataId = status.resultExternalDataIds?.[0] ?? null;
      break;
    }
    if (status.requestState === "FAILED") {
      throw new Error(`STEP export failed: ${status.failureReason ?? "unknown reason"}`);
    }
  }
  if (!externalDataId) throw new Error("STEP export timed out — try again");

  const file = await onshapeFetch(
    accessToken,
    `/documents/d/${ctx.documentId}/externaldata/${externalDataId}`,
    { headers: { Accept: "application/octet-stream" } },
  );
  return new Uint8Array(await file.arrayBuffer());
}
