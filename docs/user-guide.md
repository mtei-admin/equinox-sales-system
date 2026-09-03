# User guide

Equinox tracks sales from order through warehouse release.

## Sign in

Open the app and sign in with the email and password provided by an administrator. If you cannot sign in, an admin must confirm your Auth user and set the Equinox profile status to **active**.

## Roles

| Role | What you do in Equinox |
| --- | --- |
| Admin | Users, master data, and all documents. Full dashboard. |
| Sales | Customers, items, sales orders, invoices, ATW/DR. Dashboard shows those documents and pending actions. |
| Warehouse | Withdrawal slips; read other operational documents. Dashboard shows ATW/DR pending withdrawal and slips. |
| Accounting | Read operational documents and master data. Dashboard is a read-only transaction overview. |

## Typical day

1. **Customers** — Create or update the buyer (billing address, TIN, contacts). Inactive customers stay in history.
2. **Items** — Maintain catalog name, brand, model, serial, and barcode. There is no stock quantity in v1.
3. **Sales orders** — Select customer and items, enter quantity and unit price, save as draft, then open. Open orders can be invoiced up to remaining quantity.
4. **Invoices** — Create from an open order. Invoice quantity cannot exceed remaining SO quantity. Cancelled invoices return remaining quantity.
5. **ATW / DR** — Create from a posted invoice. Choose ATW or Delivery Receipt. Quantity cannot exceed remaining invoice quantity. Partial and multiple documents are allowed. Release so warehouse can pick. Cancelled documents return remaining quantity.
6. **Withdrawal slips** — Warehouse searches a released ATW or DR by ID or number, loads it, and saves a draft that copies every line at the same quantity. Only one non-cancelled slip is allowed. Cancel to create a replacement. Issue when the pick is complete.
7. **Reports** — Remaining SO qty, remaining posted-invoice qty, and released ATW/DR without a non-cancelled withdrawal slip. Filter by date, customer, document number, status, and sales employee. The same filters are available on the dashboard.

## Status meanings

- **Draft** — still editable (sales orders, invoices, ATW/DR, withdrawal slips).
- **Open / Posted / Released / Issued** — next document in the chain may be created. Open sales orders cannot be line-edited.
- **Closed** — sales order remaining quantity is 0.
- **Cancelled** — stopped; remaining quantity on the parent is restored.

## Users (admin)

Open **Users**, invite or list Auth users, set role, and deactivate people who should no longer sign in. Open a user to **reset their password** (admin only). The new password is stored in Supabase Auth, not in Equinox. The first account in a new project is automatically **admin**.
