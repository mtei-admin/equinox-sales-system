# User guide

Equinox tracks sales from order through warehouse release.

## Sign in

Open the app and sign in with the email and password provided by an administrator. If you cannot sign in, an admin must confirm your Auth user and set the Equinox profile status to **active**.

## Roles

| Role | What you do in Equinox |
| --- | --- |
| Admin | Users, master data, purchasing, inventory adjustments, and all documents. Full dashboard. |
| Sales | Customers, items, sales orders, invoices, ATW/DR. Can view suppliers, purchasing documents, and stock. Dashboard shows those documents and pending actions. |
| Warehouse | Withdrawal slips, inventory adjustments, bills of lading, and receiving reports. Can view purchase orders. Dashboard shows ATW/DR pending withdrawal and slips. |
| Accounting | Read operational documents, inventory, and master data. Dashboard is a read-only transaction overview. |

## Typical day

1. **Customers** — Create or update the buyer (billing address, TIN, contacts). Inactive customers stay in history.
2. **Items** — Maintain catalog name, brand, model, serial, and barcode. On-hand, commited, and available are shown on the item and on **Stock on hand**.
3. **Sales orders** — Select customer and items, enter quantity and unit price, save as draft, then open. Opening reserves quantity and is rejected if available is not enough. Open orders can be invoiced up to remaining quantity.
4. **Invoices** — Create from an open order. Invoice quantity cannot exceed remaining SO quantity. Cancelled invoices return remaining quantity. Inventory reserved does not change at invoice.
5. **ATW / DR** — Create from a posted invoice. Choose ATW or Delivery Receipt. Quantity cannot exceed remaining invoice quantity. Partial and multiple documents are allowed. Release so warehouse can pick. Cancelled documents return remaining quantity.
6. **Withdrawal slips** — Warehouse searches a released ATW or DR by ID or number, loads it, and saves a draft that copies every line at the same quantity. Only one non-cancelled slip is allowed. Cancel to create a replacement. **Issue** when the pick is complete — that is when on-hand decreases.
7. **Inventory** — Warehouse or admin posts adjustments (increase for receipts/opening stock, decrease for counts/write-offs). A decrease cannot take available below zero. Posted receiving reports also increase on-hand by the good quantity.
8. **Purchasing** — Admin maintains suppliers and purchase orders. Approve a purchase order, then create a bill of lading for the quantity still to ship. Warehouse posts the bill of lading (stock does not change yet), then creates a receiving report. Posting the receiving report adds good quantity to stock. A smaller receipt can stay open for a later receiving report. Check **Record shortage** when the missing quantity will not arrive; that shortage needs remarks and stays open until it is resolved. Damaged and excess lines also need remarks. Cancel a posted receiving report to reverse the stock movement. The original report and the original movement stay on file.
9. **Reports** — Remaining SO qty, remaining posted-invoice qty, released ATW/DR without a non-cancelled withdrawal slip, and open purchase orders. Filter sales reports by date, customer, document number, status, and sales employee. The same sales filters are available on the dashboard.

## Status meanings

- **Draft** — still editable (sales orders, invoices, ATW/DR, withdrawal slips, inventory adjustments).
- **Open / Posted / Released / Issued** — next document in the chain may be created. Open sales orders cannot be line-edited.
- **Closed** — sales order remaining quantity is 0.
- **Cancelled** — stopped; remaining quantity on the parent is restored.

## Printing

Open an invoice, ATW/DR, or withdrawal slip and choose **Print**. The print page uses the customer, address, and line details stored on that document. The top of the page is left blank for the company letterhead and logo. A cancelled document is marked cancelled. The invoice print is a copy; the number is still the pre-printed invoice number.

**Stock on hand** also has **Print**. That inventory summary lists current on-hand, commited, and available quantities.

## Install the app

Equinox can be installed from the browser. On a phone, use the browser menu and choose **Install app** or **Add to Home Screen**. The icon is a placeholder until the company logo is added. Installed Equinox still needs a connection: orders, invoices, and stock are not stored on the device. If the network is down, the app shows an offline message.

## Users (admin)

Open **Users**, invite or list Auth users, set role, and deactivate people who should no longer sign in. Open a user to **reset their password** (admin only). The new password is stored in Supabase Auth, not in Equinox. Invite and password reset need `SUPABASE_SERVICE_ROLE_KEY` on the server (Vercel or `.env.local`). The first account in a new project is automatically **admin**.
