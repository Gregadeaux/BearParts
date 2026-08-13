import { DxfInspector } from "@/components/viewer/dxf-inspector";

/** Public standalone DXF inspector — no login, nothing uploaded, all client-side. */
export default function InspectPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold">DXF Inspector</h1>
        <p className="text-sm text-muted-foreground">
          Drop a DXF to check holes, pockets, and size. Runs entirely in your browser.
        </p>
      </div>
      <DxfInspector />
    </main>
  );
}
