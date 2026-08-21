import { isOnshapeMock } from "./config";
import * as mock from "./mock";
import * as real from "./api";
import type { DxfExportResponse, FacesResponse, OnshapeDocContext, StudioContextResponse } from "./types";

/** Mock-aware dispatch — routes talk to this, never to api.ts directly. */

export function studioContext(
  accessToken: string,
  ctx: OnshapeDocContext,
): Promise<StudioContextResponse> {
  if (isOnshapeMock()) return Promise.resolve(mock.mockStudioContext());
  return real.studioContext(accessToken, ctx);
}

export function planarFaces(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
): Promise<FacesResponse> {
  if (isOnshapeMock()) return Promise.resolve(mock.mockFaces());
  return real.planarFaces(accessToken, ctx, partId);
}

export function shadedViewPng(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
): Promise<Uint8Array> {
  if (isOnshapeMock()) return Promise.resolve(mock.mockPreviewPng());
  return real.shadedViewPng(accessToken, ctx, partId);
}

export function exportFaceDxf(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
  faceId: string,
): Promise<DxfExportResponse> {
  if (isOnshapeMock()) return Promise.resolve(mock.mockDxfExport(faceId));
  return real.exportFaceDxf(accessToken, ctx, partId, faceId);
}

export function exportStep(
  accessToken: string,
  ctx: OnshapeDocContext,
  partId: string,
): Promise<Uint8Array> {
  if (isOnshapeMock()) return Promise.resolve(mock.mockStepBytes());
  return real.exportStep(accessToken, ctx, partId);
}
