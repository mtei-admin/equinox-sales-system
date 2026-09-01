"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { customerSchema } from "@/lib/validation/schemas";
import { createCustomer, updateCustomer } from "@/lib/master-data/actions";
import type { CustomerRow } from "@/types/database";

export function CustomerForm({ customer }: { customer?: CustomerRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = Boolean(customer);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const parsed = customerSchema.safeParse({
      name: formData.get("name"),
      billing_address: formData.get("billing_address") || "",
      tin_number: formData.get("tin_number") || "",
      contact_person: formData.get("contact_person") || "",
      contact_number: formData.get("contact_number") || "",
      status: formData.get("status") || "active",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid customer");
      setPending(false);
      return;
    }
    const result = editing ? await updateCustomer(formData) : await createCustomer(formData);
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.push(editing && customer ? `/customers/${customer.id}` : "/customers");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl p-5">
      <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
        <FormField label="Name" className="sm:col-span-2">
          <input className={inputClassName} name="name" required defaultValue={customer?.name} />
        </FormField>
        <FormField label="Contact person">
          <input className={inputClassName} name="contact_person" defaultValue={customer?.contact_person ?? ""} />
        </FormField>
        <FormField label="Contact number">
          <input className={inputClassName} name="contact_number" defaultValue={customer?.contact_number ?? ""} />
        </FormField>
        <FormField label="TIN number">
          <input className={inputClassName} name="tin_number" defaultValue={customer?.tin_number ?? ""} />
        </FormField>
        <FormField label="Status">
          <select className={inputClassName} name="status" defaultValue={customer?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>
        <FormField label="Billing address" className="sm:col-span-2">
          <textarea
            className={inputClassName}
            name="billing_address"
            rows={3}
            defaultValue={customer?.billing_address ?? ""}
          />
        </FormField>
        {error ? <p className="sm:col-span-2 text-sm text-rose-700">{error}</p> : null}
        <div className="sm:col-span-2">
          <button type="submit" disabled={pending} className="rounded-md bg-eq-navy px-4 py-2 text-sm text-white">
            {pending ? "Saving…" : editing ? "Save changes" : "Save customer"}
          </button>
        </div>
      </form>
    </Card>
  );
}
