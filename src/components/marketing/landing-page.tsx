import Link from "next/link";
import {
  ArrowRight,
  Blocks,
  Boxes,
  CircleDot,
  FolderOpen,
  ListTodo,
  Radio,
  ShoppingCart,
  SquareKanban,
} from "lucide-react";

/** Bear paw — the BearParts mark. */
function Paw({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden>
      <g fill="currentColor">
        <circle cx="27" cy="43" r="7" />
        <circle cx="41" cy="33" r="7.5" />
        <circle cx="57" cy="33" r="7.5" />
        <circle cx="71" cy="43" r="7" />
        <path d="M49 48c10 0 18 7 18 15 0 9-8 14-18 14s-18-5-18-14c0-8 8-15 18-15z" />
      </g>
    </svg>
  );
}

const FEATURES = [
  {
    icon: CircleDot,
    title: "DXF that reads itself",
    body: "Drop a plate in and every hole is identified — 10-32 taps, bearing bores, #10 clearances — with sizes checked against the shop's hole table.",
  },
  {
    icon: SquareKanban,
    title: "Four flows, one board",
    body: "CNC, laser, manual, and 3DP each get their own pipeline — needs toolpaths, cut to length, needs slicing — so every part knows its next step.",
  },
  {
    icon: Boxes,
    title: "Onshape, one click away",
    body: "Select a face in CAD, hit send. A DXF or STEP lands in the library, filed to its subsystem, already on the queue — and new versions stay linked.",
  },
  {
    icon: FolderOpen,
    title: "A library with memory",
    body: "Every part keeps its versions, drawings, G-code, and discussion in one place. Subsystems roll parts, tasks, and BOMs into one dashboard.",
  },
  {
    icon: ShoppingCart,
    title: "BOM to cart",
    body: "Paste a vendor link and the BOM fills itself. When it's time to order, build a cart for WCP or Thrifty Bot with everything in stock.",
  },
  {
    icon: ListTodo,
    title: "Tasks on the same clock",
    body: "Projects, subgroups, milestones, and a calendar that counts down to kickoff — with mentions and push so nothing dies in a group chat.",
  },
];

const PIPELINE = ["Design", "Queue", "Toolpaths", "Machine", "Finish", "Robot"];

/** Marketing page for signed-out visitors. */
export function LandingPage() {
  return (
    <main className="min-h-svh bg-white text-stone-900">
      {/* hero */}
      <div className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(59,130,246,0.14),transparent)]"
        />
        <Paw className="absolute -right-16 -top-16 size-96 rotate-12 text-blue-500/[0.07]" />

        <header className="relative mx-auto flex max-w-5xl items-center gap-2.5 px-6 py-5">
          <span className="flex size-8 items-center justify-center rounded-md bg-blue-600 text-white">
            <Paw className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">BearParts</span>
          <span className="flex-1" />
          <Link
            href="/login"
            className="rounded-md border border-stone-300 px-4 py-1.5 text-sm font-medium transition-colors hover:border-blue-500/60 hover:text-blue-600"
          >
            Sign in
          </Link>
        </header>

        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700">
            <Radio className="size-3" /> Live from the shop floor
          </p>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Every part, from CAD to robot,{" "}
            <span className="text-blue-600">without the chaos</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base text-stone-500 sm:text-lg">
            BearParts is the shop&apos;s single source of truth — a part library that
            understands your files, fabrication pipelines that match how the team
            actually builds, and an Onshape panel that turns a selected face into a
            queued part.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Get in the shop <ArrowRight className="size-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-stone-600 transition-colors hover:text-blue-600"
            >
              See what it does
            </a>
          </div>

          {/* pipeline strip */}
          <div className="mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-center gap-2 text-xs font-medium">
            {PIPELINE.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                <span
                  className={
                    i === PIPELINE.length - 1
                      ? "rounded-full bg-blue-600 px-3 py-1.5 text-white"
                      : "rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-stone-600"
                  }
                >
                  {stage}
                </span>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight className="size-3.5 text-stone-300" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* features */}
      <div id="features" className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Built the way the shop works
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-blue-400/60 hover:shadow-md"
            >
              <f.icon className="mb-3 size-5 text-blue-600" />
              <h3 className="mb-1.5 text-sm font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-stone-500">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* subsystem callout */}
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-8 sm:p-10">
          <Paw className="absolute -bottom-10 -right-6 size-48 -rotate-12 text-blue-500/10" />
          <div className="max-w-xl">
            <Blocks className="mb-3 size-6 text-violet-500" />
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Subsystems keep the whole picture
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-500">
              Parts, tasks, fabrication status, discussion, and the bill of materials
              for each mechanism — one dashboard the whole subteam works from, updated
              live as files land and parts move.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500"
            >
              Sign in to your team <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-6 py-6 text-xs text-stone-400">
          <Paw className="size-4 text-blue-500/60" />
          <span>BearParts — built for the Mukwonago BEARs, FRC 930</span>
          <span className="flex-1" />
          <span>CAD to robot, one queue at a time</span>
        </div>
      </footer>
    </main>
  );
}
