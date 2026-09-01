"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { itemSchema } from "@/lib/validation/schemas";
import { createItem, updateItem } from "@/lib/master-data/actions";
import type { ItemRow } from "@/types/database";

export function ItemForm({ item }: { item?: ItemRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = Boolean(item);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const parsed = itemSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || "",
      brand: formData.get("brand") || "",
      model: formData.get("model") || "",
      serial_no: formData.get("serial_no") || "",
      barcode: formData.get("barcode") || "",
      status: formData.get("status") || "active",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid item");
      setPending(false);
      return;
    }
    const result = editing ? await updateItem(formData) : await createItem(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(editing && item ? `/items/${item.id}` : "/items");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl p-5">
      <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <FormField label="Name" className="sm:col-span-2">
          <input className={inputClassName} name="name" required defaultValue={item?.name} />
        </FormField>
        <FormField label="Brand">
          <input className={inputClassName} name="brand" defaultValue={item?.brand ?? ""} />
        </FormField>
        <FormField label="Model">
          <input className={inputClassName} name="model" defaultValue={item?.model ?? ""} />
        </FormField>
        <FormField label="Serial no.">
          <input className={inputClassName} name="serial_no" defaultValue={item?.serial_no ?? ""} />
        </FormField>
        <FormField label="Barcode">
          <input className={inputClassName} name="barcode" defaultValue={item?.barcode ?? ""} />
        </FormField>
        <FormField label="Status">
          <select className={inputClassName} name="status" defaultValue={item?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
        <FormField label="Description" className="sm:col-span-2">
          <textarea className={inputClassName} name="description" rows={3} defaultValue={item?.description ?? ""} />
        </FormField>
        {error ? <p className="sm:col-span-2 text-sm text-rose-700">{error}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white">
            {pending ? "Saving…" : editing ? "Save changes" : "Save item"}
          </button>
        </div>
      </form>
    </Card>
  );
}
