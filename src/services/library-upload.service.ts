import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PartFileType, PartPriority } from "@/types/part";
import * as library from "./library.service";
import * as partsService from "./parts.service";
import { uploadToPath } from "./storage.service";
import { analyzeDxfText } from "./dxf/analysis.service";
import type { NewVersionInput } from "./library.service";

type Client = SupabaseClient<Database>;

/** Build version metadata from an uploaded file; DXF gets analyzed server-side. */
export async function versionInputFromFile(
  file: File,
  note?: string,
): Promise<NewVersionInput & { fileType: PartFileType }> {
  const ext = file.name.toLowerCase().match(/\.(dxf|stl|pdf|step|stp)$/)?.[1];
  const fileType = (ext === "stp" ? "step" : (ext ?? null)) as PartFileType | null;
  if (!fileType) throw new Error("Only .dxf, .stl, .pdf, and .step files are supported");

  if (fileType === "dxf") {
    const { analysis } = analyzeDxfText(await file.text());
    return { filePath: "", fileType, units: analysis.units, analysis, note };
  }
  return { filePath: "", fileType, note };
}

export interface LibraryUploadInput {
  file: File;
  folderId: string;
  name: string;
  /** client-rendered preview PNG, optional */
  thumb?: File | Blob | null;
  note?: string;
}

/**
 * Create a library part with its v1 from an uploaded file. Shared by the
 * library upload action and the Onshape import route.
 */
export async function createLibraryPartFromFile(
  supabase: Client,
  userId: string,
  { file, folderId, name, thumb, note }: LibraryUploadInput,
) {
  const input = await versionInputFromFile(file, note);
  const part = await library.createLibraryPartRow(
    supabase,
    userId,
    folderId,
    name.trim() || file.name.replace(/\.(dxf|stl|pdf|step|stp)$/i, ""),
  );
  input.filePath = library.versionFilePath(part.id, 1, input.fileType);
  await uploadToPath(supabase, file, input.filePath, input.fileType);
  if (thumb && thumb.size > 0) {
    try {
      const path = library.versionThumbPath(part.id, 1);
      await uploadToPath(supabase, thumb, path, "png");
      input.thumbPath = path;
    } catch {
      // a missing preview never fails an upload
    }
  }
  const version = await library.insertVersion(supabase, userId, part.id, 1, input);
  return { part, version, fileType: input.fileType };
}

export interface QueueFromVersionOptions {
  name: string;
  quantity: number;
  priority: PartPriority;
  material?: string;
  description?: string;
}

/** Send a freshly imported version straight to the fab queue. */
export async function queueImportedVersion(
  supabase: Client,
  userId: string,
  version: Awaited<ReturnType<typeof library.insertVersion>>,
  options: QueueFromVersionOptions,
) {
  return partsService.createPart(supabase, userId, {
    ...options,
    filePath: version.file_path,
    fileType: version.file_type,
    units: version.units,
    analysis: version.analysis ?? undefined,
    sourceVersionId: version.id,
    thumbPath: version.thumb_path,
  });
}
