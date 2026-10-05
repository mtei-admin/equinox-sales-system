# Business rules

**Status:** approved.

## Chain and lineage

Sales Order → Invoice → ATW/DR → Withdrawal Slip.

- One SO : many invoices. One invoice : many ATW/DR. One ATW : **zero or one non-cancelled** WS.
- SO items from item master. Invoice items from SO items. ATW items from invoice items. WS items from ATW items (full copy of the ATW).
- ATW and DR share `atw_documents.document_type`.
- InvoiceNumber is typed. Snapshots are frozen on create.

## Quantity

```
SO remaining = SO qty − sum(non-cancelled invoice qty on that SO item)
Invoice remaining = invoice qty − sum(non-cancelled ATW qty on that invoice item)
```

Reject over-allocation. Concurrent users: row locks in RPCs.

## Totals

- `Amount = Quantity × UnitPrice`
- SO/ATW/WS: `TotalAmount = Amount`
- Invoice: `TotalAmount = Amount + TaxAmount` (tax typed, no rate table)
- Header totals = sums of lines

## Status

| Document | Draft | Released | Terminal |
| --- | --- | --- | --- |
| SO | `draft` | `open` | `closed`, `cancelled` |
| Invoice | `draft` | `posted` | `cancelled` |
| ATW/DR | `draft` | `released` | `cancelled` |
| WS | `draft` | `issued` | `cancelled` |
| Inventory adjustment | `draft` | `posted` | `cancelled` |
| Customer/Item/User/Warehouse | — | `active` | `inactive` |

Next document only from released status. Drafts editable via RPC. Posted/issued lines are not edited; correction is cancel + new document if remaining qty allows.

Cancel is a status change (not delete). Blocked if a non-cancelled child exists. Cancelling a WS allows a new WS on that ATW (D20).

SO `closed` when remaining qty is 0 on all lines; may return to `open` if an invoice is cancelled.

## Inventory

- On-hand = sum of posted movements (adjustments and issued withdrawal slips).
- Reserved = quantity on **open** or **closed** sales orders that has not been issued on a withdrawal slip. Draft SO does not reserve.
- Available = on-hand − reserved. Available cannot go negative.
- Opening an SO is rejected if any item’s required qty exceeds available.
- Physical stock decreases when a withdrawal slip is **issued**. Cancelling an issued slip restores on-hand and reserved.
- Adjustments are documents (`draft` / `posted` / `cancelled`). Posting writes movements. One warehouse (Main) in this phase; `warehouse_id` is stored for later locations.
- A posted receiving report writes a positive `receiving_report` movement for **good** quantity only. Damaged quantity is a discrepancy and is not usable stock. Cancelling a posted receiving report writes a reversing movement and does not delete the original.

## Purchasing

Supplier → Purchase Order → Bill of Lading → Receiving Report → stock on hand.

- Supplier code is server-generated and unique. Inactive suppliers are not deleted.
- Purchase order approval does not change inventory. A bill of lading does not change inventory until a receiving report is posted.
- One purchase order can have many bills of lading. One bill of lading can have many receiving reports. Partial shipment and partial receiving are allowed.
- Posted BOL shipped quantity cannot exceed remaining PO quantity. Two drafts may be saved; the second post fails if the remaining quantity was already taken.
- Short, damaged, and excess receipts require remarks and stay open until resolved. Shipped quantity on the BOL is not rewritten. A purchase order is `completed` only when every line is fully shipped, received quantity plus accepted or resolved short quantity covers the order, and no discrepancy is still open.
- `closed` blocks new bills of lading and receiving reports. Cancelled numbers are not reused.

## Roles

| Role | SO / Invoice / ATW | WS | Inventory adj. | Customers / Items | Suppliers / PO | BOL / Receiving | Users |
| --- | --- | --- | --- | --- | --- | --- | --- |
| admin | write | write | write | write | write | write | manage |
| sales | write | read | read | write | read | read | no |
| warehouse | read | write | write | read | read | write | no |
| accounting | read | read | read | read | read | read | no |

## Out of scope (v1)

Payments/AR/credit limit, official letterhead and logo, warehouse picker / transfers, serial-level stock. Invoice, ATW/DR, and withdrawal slip can be printed from their stored snapshots.
