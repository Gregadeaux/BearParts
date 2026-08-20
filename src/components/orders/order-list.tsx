"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, PackageCheck, ShoppingCart, Undo2 } from "lucide-react";
import {
  BOM_VENDORS,
  VENDOR_URLS,
  type BomStatus,
  type BomVendor,
  type OrderItem,
} from "@/services/bom.service";
import { setBomStatusAction } from "@/app/actions/subsystems";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const VENDOR_LABEL = Object.fromEntries(BOM_VENDORS.map((v) => [v.value, v.label]));

interface Props {
  initial: OrderItem[];
}

/** Mentor order list: to-order items grouped by vendor, then in-flight orders. */
export function OrderList({ initial }: Props) {
  const [items, setItems] = useState(initial);

  const setStatus = (ids: string[], status: BomStatus, label: string) => {
    const idSet = new Set(ids);
    const before = items;
    // received items leave this page; other flips just move sections
    setItems((list) =>
      list
        .map((i) => (idSet.has(i.id) ? { ...i, status } : i))
        .filter((i) => i.status === "to_order" || i.status === "ordered"),
    );
    setBomStatusAction(ids, status)
      .then(() => toast.success(label))
      .catch(() => {
        toast.error("Could not update items");
        setItems(before);
      });
  };

  const toOrder = items.filter((i) => i.status === "to_order");
  const ordered = items.filter((i) => i.status === "ordered");

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border py-14 text-muted-foreground">
        <ShoppingCart className="size-6" />
        <p className="text-sm">Nothing to order.</p>
        <p className="max-w-sm text-center text-xs">
          Set a BOM item&apos;s status to &ldquo;To order&rdquo; on a subsystem page and it shows up
          here, grouped by vendor.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          To order
          {toOrder.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {toOrder.length} items
            </span>
          )}
        </h2>
        {toOrder.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            Order list is empty.
          </p>
        ) : (
          groupByVendor(toOrder).map(([vendor, group]) => (
            <VendorGroup
              key={vendor}
              vendor={vendor}
              items={group}
              action={
                <Button size="sm" onClick={() => setStatus(group.map((i) => i.id), "ordered", `${VENDOR_LABEL[vendor]} marked ordered`)}>
                  <Check /> Mark ordered
                </Button>
              }
              onRemove={(item) => setStatus([item.id], "planned", "Moved back to planned")}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Ordered — awaiting delivery
          {ordered.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {ordered.length} items
            </span>
          )}
        </h2>
        {ordered.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            No orders in flight.
          </p>
        ) : (
          groupByVendor(ordered).map(([vendor, group]) => (
            <VendorGroup
              key={vendor}
              vendor={vendor}
              items={group}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus(group.map((i) => i.id), "received", `${VENDOR_LABEL[vendor]} marked received`)}
                >
                  <PackageCheck /> All received
                </Button>
              }
              perItem={(item) => (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setStatus([item.id], "received", "Marked received")}
                >
                  <PackageCheck /> Received
                </Button>
              )}
              onRemove={(item) => setStatus([item.id], "to_order", "Moved back to order list")}
              removeIcon="undo"
            />
          ))
        )}
      </section>
    </div>
  );
}

function groupByVendor(items: OrderItem[]): [BomVendor, OrderItem[]][] {
  const groups = new Map<BomVendor, OrderItem[]>();
  for (const item of items) {
    const vendor = item.vendor as BomVendor;
    groups.set(vendor, [...(groups.get(vendor) ?? []), item]);
  }
  return [...groups.entries()];
}

function VendorGroup({
  vendor,
  items,
  action,
  perItem,
  onRemove,
  removeIcon = "undo",
}: {
  vendor: BomVendor;
  items: OrderItem[];
  action: React.ReactNode;
  perItem?: (item: OrderItem) => React.ReactNode;
  onRemove: (item: OrderItem) => void;
  removeIcon?: "undo";
}) {
  const subtotal = items.reduce(
    (sum, i) => (i.unit_price === null ? sum : sum + Number(i.unit_price) * i.quantity),
    0,
  );
  const storeUrl = VENDOR_URLS[vendor];

  const copyList = () => {
    const lines = items.map(
      (i) => `${i.quantity}x ${i.name}${i.sku ? ` (${i.sku})` : ""}`,
    );
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("List copied"))
      .catch(() => toast.error("Could not copy"));
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium">{VENDOR_LABEL[vendor] ?? vendor}</span>
        {storeUrl && (
          <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Open ${VENDOR_LABEL[vendor]} store`}
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
        <div className="flex-1" />
        {subtotal > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            ~${subtotal.toFixed(2)}
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={copyList}>
          <Copy /> Copy list
        </Button>
        {action}
      </div>
      <div className="divide-y">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 px-3 py-2">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate text-sm">{item.name}</span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Open product page"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </span>
            {item.sku && (
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {item.sku}
              </span>
            )}
            {item.subsystem && (
              <Link href={`/subsystems/${item.subsystem.id}`} className="shrink-0">
                <Badge variant="outline" className="hover:bg-muted">
                  {item.subsystem.name}
                </Badge>
              </Link>
            )}
            <span className="w-10 shrink-0 text-right text-sm tabular-nums">
              ×{item.quantity}
            </span>
            <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:inline">
              {item.unit_price === null
                ? ""
                : `$${(Number(item.unit_price) * item.quantity).toFixed(2)}`}
            </span>
            {perItem?.(item)}
            <button
              type="button"
              aria-label={removeIcon === "undo" ? "Move back" : "Remove"}
              title="Move back"
              onClick={() => onRemove(item)}
              className="hidden shrink-0 text-muted-foreground hover:text-foreground group-hover:block"
            >
              <Undo2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
