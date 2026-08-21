"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import * as folders from "@/services/folders.service";
import * as library from "@/services/library.service";
import { deleteFiles, uploadToPath } from "@/services/storage.service";
import * as versionDocs from "@/services/version-documents.service";
import { createLibraryPartFromFile, versionInputFromFile } from "@/services/library-upload.service";
import { createPartAction } from "./parts";
import type { PartPriority } from "@/types/part";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function createFolderAction(name: string, parentId: string | null) {
  const { supabase, user } = await requireUser();
  const folder = await folders.createFolder(supabase, user.id, name, parentId);
  revalidatePath("/library");
  return { id: folder.id };
}

export async function deleteFolderAction(folderId: string) {
  const { supabase } = await requireUser();
  await folders.deleteEmptyFolder(supabase, folderId);
  revalidatePath("/library");
}

export async function addVersionDocumentAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const versionId = formData.get("versionId");
  const libraryPartId = formData.get("libraryPartId");
  const version = Number(formData.get("version"));
  const file = formData.get("file");
  if (
    typeof versionId !== "string" ||
    typeof libraryPartId !== "string" ||
    !Number.isFinite(version) ||
    !(file instanceof File) ||
    file.size === 0
  )
    throw new Error("A file is required");

  const doc = await versionDocs.addVersionDocument(supabase, user.id, {
    versionId,
    libraryPartId,
    version,
    file,
  });
  revalidatePath(`/library/parts/${libraryPartId}`);
  return doc;
}

export async function deleteVersionDocumentAction(documentId: string, libraryPartId: string) {
  const { supabase } = await requireUser();
  await versionDocs.deleteVersionDocument(supabase, documentId);
  revalidatePath(`/library/parts/${libraryPartId}`);
}

export async function deleteLibraryPartAction(libraryPartId: string) {
  const { supabase } = await requireUser();
  const orphanedPaths = await library.deleteLibraryPart(supabase, libraryPartId);
  await deleteFiles(supabase, orphanedPaths);
  revalidatePath("/library");
}

/** Store the client-rendered preview PNG if the form included one. */
async function maybeUploadThumb(
  supabase: Awaited<ReturnType<typeof createClient>>,
  formData: FormData,
  libraryPartId: string,
  version: number,
): Promise<string | undefined> {
  const thumb = formData.get("thumb");
  if (!(thumb instanceof File) || thumb.size === 0) return undefined;
  try {
    const path = library.versionThumbPath(libraryPartId, version);
    await uploadToPath(supabase, thumb, path, "png");
    return path;
  } catch {
    return undefined; // a missing preview never fails an upload
  }
}

/** Upload a new part into a folder (creates the part + v1). */
export async function createLibraryPartAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("file") as File | null;
  const folderId = formData.get("folderId") as string;
  const name = ((formData.get("name") as string) || "").trim();
  if (!file || !folderId) throw new Error("File and folder are required");

  const thumb = formData.get("thumb");
  const { part } = await createLibraryPartFromFile(supabase, user.id, {
    file,
    folderId,
    name,
    thumb: thumb instanceof File ? thumb : null,
  });

  revalidatePath("/library");
  return { id: part.id };
}

/** Append the next version to an existing library part. */
export async function addVersionAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const file = formData.get("file") as File | null;
  const libraryPartId = formData.get("libraryPartId") as string;
  const note = ((formData.get("note") as string) || "").trim() || undefined;
  if (!file || !libraryPartId) throw new Error("File is required");

  const input = await versionInputFromFile(file, note);
  const versionNumber = await library.nextVersionNumber(supabase, libraryPartId);
  input.filePath = library.versionFilePath(libraryPartId, versionNumber, input.fileType);
  await uploadToPath(supabase, file, input.filePath, input.fileType);
  input.thumbPath = await maybeUploadThumb(supabase, formData, libraryPartId, versionNumber);
  await library.insertVersion(supabase, user.id, libraryPartId, versionNumber, input);

  revalidatePath(`/library/parts/${libraryPartId}`);
  return { version: versionNumber };
}

/** Send a specific library version to the fab queue. */
export async function queueFromVersionAction(
  versionId: string,
  options: {
    name: string;
    quantity: number;
    priority: PartPriority;
    material?: string;
    description?: string;
    assignedTo?: string | null;
  },
) {
  const { supabase } = await requireUser();
  const version = await library.getVersion(supabase, versionId);
  if (!version) throw new Error("Version not found");

  const result = await createPartAction({
    ...options,
    filePath: version.file_path,
    fileType: version.file_type,
    units: version.units,
    analysis: version.analysis ?? undefined,
    sourceVersionId: version.id,
    thumbPath: version.thumb_path,
  });
  revalidatePath(`/library/parts/${version.library_part_id}`);
  return result;
}
