"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { createSupplier, updateSupplier } from "@/lib/purchasing/actions";
import { supplierSchema } from "@/lib/validation/schemas";
import type { SupplierRow } from "@/types/database";

export function SupplierForm({ supplier }: { supplier?: SupplierRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = Boolean(supplier);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const parsed = supplierSchema.safeParse({
      name: formData.get("name"),
      address: formData.get("address") || "",
      contact_person: formData.get("contact_person") || "",
      contact_number: formData.get("contact_number") || "",
      email: formData.get("email") || "",
      tin_number: formData.get("tin_number") || "",
      payment_terms: formData.get("payment_terms") || "",
      remarks: formData.get("remarks") || "",
      status: formData.get("status") || "active",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid supplier");
      setPending(false);
      return;
    }
    const result = editing ? await updateSupplier(formData) : await createSupplier(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(editing && supplier ? `/suppliers/${supplier.id}` : "/suppliers");
    router.refresh();
  }

  return (
    <Card>
      <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
        {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
        {supplier ? <FormField label="Supplier code"><input className={inputClassName} value={supplier.supplier_code} readOnly /></FormField> : null}
        <FormField label="Supplier name"><input name="name" required defaultValue={supplier?.name} className={inputClassName} /></FormField>
        <FormField label="Contact person"><input name="contact_person" defaultValue={supplier?.contact_person ?? ""} className={inputClassName} /></FormField>
        <FormField label="Contact number"><input name="contact_number" defaultValue={supplier?.contact_number ?? ""} className={inputClassName} /></FormField>
        <FormField label="Email"><input name="email" type="email" defaultValue={supplier?.email ?? ""} className={inputClassName} /></FormField>
        <FormField label="TIN"><input name="tin_number" defaultValue={supplier?.tin_number ?? ""} className={inputClassName} /></FormField>
        <FormField label="Payment terms"><input name="payment_terms" defaultValue={supplier?.payment_terms ?? ""} className={inputClassName} /></FormField>
        <FormField label="Status">
          <select name="status" defaultValue={supplier?.status ?? "active"} className={inputClassName}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
        <div className="md:col-span-2">
          <FormField label="Address"><textarea name="address" defaultValue={supplier?.address ?? ""} className={inputClassName} rows={2} /></FormField>
        </div>
        <div className="md:col-span-2">
          <FormField label="Remarks"><textarea name="remarks" defaultValue={supplier?.remarks ?? ""} className={inputClassName} rows={2} /></FormField>
        </div>
        {error ? <p className="md:col-span-2 text-sm text-red-700">{error}</p> : null}
        <div className="md:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-3.5 py-2 text-sm text-white disabled:opacity-60">
            {pending ? "Saving..." : "Save supplier"}
          </button>
        </div>
      </form>
    </Card>
  );
}
