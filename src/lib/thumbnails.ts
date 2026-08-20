"use client";

import type { PartFileType } from "@/types/part";

const W = 480;
const H = 360;

/**
 * Render a small PNG preview of a part file, in the browser, at upload time.
 * Returns null on any failure — uploads never block on a thumbnail.
 */
export async function generateThumbnail(file: File, fileType: PartFileType): Promise<Blob | null> {
  try {
    if (fileType === "dxf") return await dxfThumb(await file.text());
    if (fileType === "stl") return await stlThumb(await file.arrayBuffer());
    if (fileType === "step") return await stepThumb(await file.arrayBuffer());
    return await pdfThumb(await file.arrayBuffer());
  } catch {
    return null;
  }
}

async function stepThumb(buffer: ArrayBuffer): Promise<Blob | null> {
  const { parseStep } = await import("@/services/step/step-parser");
  return renderMeshThumb(await parseStep(buffer));
}

async function dxfThumb(text: string): Promise<Blob | null> {
  const { analyzeDxfText } = await import("@/services/dxf/analysis.service");
  const { entitiesToSvgPaths, entitiesBBox } = await import("@/services/dxf/render.service");
  const { entities } = analyzeDxfText(text);
  const bb = entitiesBBox(entities);
  if (bb.width <= 0 || bb.height <= 0) return null;

  const margin = Math.max(bb.width, bb.height) * 0.05;
  const stroke = Math.max(bb.width, bb.height) / 220;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bb.min.x - margin} ${-bb.max.y - margin} ${bb.width + 2 * margin} ${bb.height + 2 * margin}">` +
    `<g transform="scale(1,-1)" fill="none" stroke="#18181b" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    entitiesToSvgPaths(entities)
      .map((d) => `<path d="${d}"/>`)
      .join("") +
    `</g></svg>`;

  const img = await loadImage(URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })));
  return drawContained(img);
}

async function stlThumb(buffer: ArrayBuffer): Promise<Blob | null> {
  const { parseStl } = await import("@/services/stl/stl-parser");
  return renderMeshThumb(parseStl(buffer));
}

async function renderMeshThumb(
  mesh: import("@/services/stl/stl-parser").StlMesh,
): Promise<Blob | null> {
  const THREE = await import("three");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  try {
    const scene = new THREE.Scene();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
    geometry.computeVertexNormals();
    geometry.center();
    scene.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55, flatShading: true }),
      ),
    );
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    // frame the part's bounding sphere so thumbnails fill the image
    const { size } = mesh.boundingBox;
    const radius = Math.max(0.5 * Math.hypot(size.x, size.y, size.z), 0.001);
    const vFov = (45 * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (W / H));
    // 0.8 crops into the bounding sphere — real silhouettes rarely reach it, so
    // parts fill the frame instead of floating in it
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.8;

    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(dist, -dist, dist * 2);
    scene.add(light);

    const camera = new THREE.PerspectiveCamera(45, W / H, dist / 100, dist + radius * 4);
    camera.up.set(0, 0, 1);
    camera.position.copy(new THREE.Vector3(1, -1, 0.75).normalize().multiplyScalar(dist));
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    const blob = await canvasToBlob(canvas);
    geometry.dispose();
    return blob;
  } finally {
    renderer.dispose();
  }
}

async function pdfThumb(buffer: ArrayBuffer): Promise<Blob | null> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const task = pdfjs.getDocument({ data: buffer.slice(0) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(W / base.width, H / base.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvasToBlob(canvas);
  } finally {
    task.destroy().catch(() => {});
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function drawContained(img: HTMLImageElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  return canvasToBlob(canvas);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
