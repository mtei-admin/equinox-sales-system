"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/page-header";
import { FormField, inputClassName } from "@/components/form-field";
import { customerSchema } from "@/lib/validation/schemas";
import { createCustomer, updateCustomer } from "@/lib/master-data/actions";
import type { CustomerRow } from "@/types/database";

function startingNumbers(customer?: CustomerRow) {
  if (customer?.contact_numbers?.length) return customer.contact_numbers;
  if (customer?.contact_number) return [customer.contact_number];
  return [""];
}

export function CustomerForm({ customer }: { customer?: CustomerRow }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [numbers, setNumbers] = useState<string[]>(() => startingNumbers(customer));
  const editing = Boolean(customer);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const parsed = customerSchema.safeParse({
      name: formData.get("name"),
      billing_address: formData.get("billing_address") || "",
      tin_number: formData.get("tin_number") || "",
      contact_person: formData.get("contact_person") || "",
      contact_numbers: formData.getAll("contact_numbers").map(String),
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
        <FormField label="TIN number">
          <input className={inputClassName} name="tin_number" defaultValue={customer?.tin_number ?? ""} />
        </FormField>
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-eq-slate">Contact numbers</span>
            <button
              type="button"
              className="text-sm font-medium text-eq-navy"
              onClick={() => setNumbers((current) => [...current, ""])}
            >
              + Add contact
            </button>
          </div>
          <div className="space-y-2">
            {numbers.map((number, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className={inputClassName}
                  name="contact_numbers"
                  value={number}
                  aria-label={`Contact number ${index + 1}`}
                  onChange={(event) =>
                    setNumbers((current) => current.map((value, item) => (item === index ? event.target.value : value)))
                  }
                />
                {numbers.length > 1 ? (
                  <button
                    type="button"
                    className="shrink-0 text-sm text-rose-700"
                    onClick={() => setNumbers((current) => current.filter((_, item) => item !== index))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
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
