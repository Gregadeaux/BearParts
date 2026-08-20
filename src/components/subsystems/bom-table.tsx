"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import {
  BOM_STATUSES,
  BOM_VENDORS,
  type BomItemRow,
  type BomStatus,
  type BomVendor,
} from "@/services/bom.service";
import {
  addBomItemAction,
  deleteBomItemAction,
  updateBomItemAction,
} from "@/app/actions/subsystems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VENDOR_LABEL = Object.fromEntries(BOM_VENDORS.map((v) => [v.value, v.label]));
const VENDOR_ITEMS = BOM_VENDORS.map((v) => ({ value: v.value, label: v.label }));
const STATUS_ITEMS = BOM_STATUSES.map((s) => ({ value: s.value, label: s.label }));

interface Props {
  subsystemId: string;
  initial: BomItemRow[];
  /** the subsystem's own library parts, for vendor = Custom */
  customParts: { id: string; name: string }[];
}

/** Bill of materials: custom parts + vendor items with quantities and order status. */
export function BomTable({ subsystemId, initial, customParts }: Props) {
  const [items, setItems] = useState(initial);

  const patchLocal = (id: string, patch: Partial<BomItemRow>) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const changeQty = (item: BomItemRow, quantity: number) => {
    if (quantity < 1) return;
    patchLocal(item.id, { quantity });
    updateBomItemAction(item.id, { quantity }).catch(() => {
      toast.error("Could not update quantity");
      patchLocal(item.id, { quantity: item.quantity });
    });
  };

  const changeStatus = (item: BomItemRow, status: BomStatus) => {
    patchLocal(item.id, { status });
    updateBomItemAction(item.id, { status }).catch(() => {
      toast.error("Could not update status");
      patchLocal(item.id, { status: item.status });
    });
  };

  const remove = (item: BomItemRow) => {
    setItems((list) => list.filter((i) => i.id !== item.id));
    deleteBomItemAction(item.id).catch(() => {
      toast.error("Could not remove item");
      setItems((list) => [...list, item]);
    });
  };

  const total = items.reduce(
    (sum, i) => (i.unit_price === null ? sum : sum + Number(i.unit_price) * i.quantity),
    0,
  );

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className="group">
                  <td className="max-w-48 px-3 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{item.name}</span>
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
                  </td>
                  <td className="px-3 py-1.5">
                    <Badge variant={item.vendor === "custom" ? "secondary" : "outline"}>
                      {VENDOR_LABEL[item.vendor] ?? item.vendor}
                    </Badge>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{item.sku ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => changeQty(item, item.quantity - 1)}
                        className="hidden text-muted-foreground hover:text-foreground group-hover:block"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-6 text-right tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => changeQty(item, item.quantity + 1)}
                        className="hidden text-muted-foreground hover:text-foreground group-hover:block"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted-foreground">
                    {item.unit_price === null ? "—" : `$${(Number(item.unit_price) * item.quantity).toFixed(2)}`}
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={item.status}
                      items={STATUS_ITEMS}
                      onValueChange={(v) => v && changeStatus(item, v as BomStatus)}
                    >
                      <SelectTrigger size="sm" className="h-7 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ITEMS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => remove(item)}
                      className="hidden text-muted-foreground hover:text-destructive group-hover:block"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {total > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/30 text-xs">
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">
                    Priced total
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    ${total.toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      <AddItemRow
        subsystemId={subsystemId}
        customParts={customParts}
        onAdded={(item) => setItems((list) => [...list, item])}
      />
    </div>
  );
}

function AddItemRow({
  subsystemId,
  customParts,
  onAdded,
}: {
  subsystemId: string;
  customParts: { id: string; name: string }[];
  onAdded: (item: BomItemRow) => void;
}) {
  const [vendor, setVendor] = useState<BomVendor>("custom");
  const [partId, setPartId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [url, setUrl] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();

  const partItems = customParts.map((p) => ({ value: p.id, label: p.name }));
  const isCustom = vendor === "custom";
  const resolvedName = isCustom ? (customParts.find((p) => p.id === partId)?.name ?? "") : name.trim();
  const quantity = Math.max(1, parseInt(qty, 10) || 1);
  const canAdd = resolvedName.length > 0 && !pending;

  const add = () =>
    startTransition(async () => {
      if (!resolvedName) return;
      try {
        const item = await addBomItemAction(subsystemId, {
          vendor,
          name: resolvedName,
          libraryPartId: isCustom ? partId : null,
          sku: sku || null,
          url: url || null,
          quantity,
          unitPrice: price ? parseFloat(price) : null,
        });
        onAdded(item);
        setPartId(null);
        setName("");
        setSku("");
        setUrl("");
        setQty("1");
        setPrice("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add item");
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed p-2">
      <Select value={vendor} items={VENDOR_ITEMS} onValueChange={(v) => v && setVendor(v as BomVendor)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VENDOR_ITEMS.map((v) => (
            <SelectItem key={v.value} value={v.value}>
              {v.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isCustom ? (
        <Select value={partId} items={partItems} onValueChange={setPartId}>
          <SelectTrigger size="sm" className="min-w-40 flex-1">
            <SelectValue placeholder={customParts.length ? "Pick a part" : "No parts yet"} />
          </SelectTrigger>
          <SelectContent>
            {partItems.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="h-8 min-w-32 flex-1"
          />
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU"
            className="h-8 w-24"
          />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link"
            className="h-8 w-28"
          />
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$"
            inputMode="decimal"
            className="h-8 w-16"
          />
        </>
      )}

      <Input
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        inputMode="numeric"
        aria-label="Quantity"
        className="h-8 w-14 text-right"
      />
      <Button size="sm" disabled={!canAdd} onClick={add}>
        <Plus /> Add
      </Button>
    </div>
  );
}
