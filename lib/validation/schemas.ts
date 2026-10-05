import { z } from "zod";

const money = z.coerce.number().min(0);
const qty = z.coerce.number().positive("Quantity must be greater than 0");

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dots, underscores, and hyphens"),
  full_name: z.string().trim().min(2).max(160),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});

export const inviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().trim().min(2).max(160),
  username: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dots, underscores, and hyphens"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "sales", "warehouse", "accounting"]),
  department: z.string().trim().max(120).optional().or(z.literal("")),
});

export const userAdminSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(2).max(160),
  username: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dots, underscores, and hyphens"),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  role: z.enum(["admin", "sales", "warehouse", "accounting"]),
  status: z.enum(["active", "inactive"]),
});

export const userAccessSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "sales", "warehouse", "accounting"]),
  status: z.enum(["active", "inactive"]),
});

export const resetPasswordSchema = z
  .object({
    user_id: z.string().uuid(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((value) => value.password === value.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  contact_number: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.union([z.literal(""), z.string().trim().email()]),
  tin_number: z.string().trim().max(40).optional().or(z.literal("")),
  payment_terms: z.string().trim().max(120).optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const purchaseOrderLineSchema = z.object({
  item_id: z.string().uuid(),
  ordered_qty: qty,
  unit_cost: money,
  uom: z.string().trim().min(1).max(20),
});

export const purchaseOrderSchema = z.object({
  supplier_id: z.string().uuid(),
  po_date: z.string().min(1),
  expected_delivery_date: z.string().optional().or(z.literal("")),
  destination: z.string().trim().max(200).optional().or(z.literal("")),
  payment_terms: z.string().trim().max(120).optional().or(z.literal("")),
  supplier_reference: z.string().trim().max(80).optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z.array(purchaseOrderLineSchema).min(1),
});

export const billOfLadingLineSchema = z.object({
  purchase_order_item_id: z.string().uuid(),
  shipped_qty: z.coerce.number().min(0),
});

export const billOfLadingSchema = z.object({
  purchase_order_id: z.string().uuid(),
  shipment_mode: z.enum(["sea", "land"]),
  shipment_date: z.string().min(1),
  expected_arrival_date: z.string().optional().or(z.literal("")),
  carrier: z.string().trim().max(120).optional().or(z.literal("")),
  vessel_name: z.string().trim().max(120).optional().or(z.literal("")),
  voyage_number: z.string().trim().max(80).optional().or(z.literal("")),
  container_number: z.string().trim().max(80).optional().or(z.literal("")),
  seal_number: z.string().trim().max(80).optional().or(z.literal("")),
  vehicle_plate_number: z.string().trim().max(40).optional().or(z.literal("")),
  origin: z.string().trim().max(160).optional().or(z.literal("")),
  destination: z.string().trim().max(160).optional().or(z.literal("")),
  reference_number: z.string().trim().max(80).optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z.array(billOfLadingLineSchema).min(1),
});

export const receivingLineSchema = z.object({
  bol_item_id: z.string().uuid(),
  good_qty: z.coerce.number().min(0),
  damaged_qty: z.coerce.number().min(0),
  accept_excess: z.boolean().optional(),
  record_short: z.boolean().optional(),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
});

export const receivingReportSchema = z.object({
  bill_of_lading_id: z.string().uuid(),
  receiving_date: z.string().min(1),
  delivery_receipt_number: z.string().trim().max(80).optional().or(z.literal("")),
  supplier_invoice_number: z.string().trim().max(80).optional().or(z.literal("")),
  received_by: z.string().uuid().optional().or(z.literal("")),
  checked_by: z.string().uuid().optional().or(z.literal("")),
  remarks: z.string().trim().max(500).optional().or(z.literal("")),
  gross_weight: z.string().optional().or(z.literal("")),
  tare_weight: z.string().optional().or(z.literal("")),
  weighbridge_ticket: z.string().trim().max(80).optional().or(z.literal("")),
  lines: z.array(receivingLineSchema).min(1),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2).max(160),
  billing_address: z.string().trim().max(500).optional().or(z.literal("")),
  tin_number: z.string().trim().max(40).optional().or(z.literal("")),
  contact_person: z.string().trim().max(120).optional().or(z.literal("")),
  contact_number: z.string().trim().max(40).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const itemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  brand: z.string().trim().max(80).optional().or(z.literal("")),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  serial_no: z.string().trim().max(80).optional().or(z.literal("")),
  barcode: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).default("active"),
});

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));

export const salesOrderLineSchema = z.object({
  item_id: z.string().uuid("Select an item"),
  quantity: qty,
  unit_price: money,
  uom: z.string().trim().min(1).max(20).default("PCS"),
  model: optionalText,
  serial_no: optionalText,
  barcode: optionalText,
  description: optionalText,
});

export const salesOrderSchema = z.object({
  customer_id: z.string().uuid("Select a customer"),
  delivery_address: optionalText,
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Order date is required"),
  term: z.string().trim().max(80).optional().or(z.literal("")),
  reference_no: z.string().trim().max(80).optional().or(z.literal("")),
  order_type: z.string().trim().max(80).optional().or(z.literal("")),
  sales_employee_id: z.string().uuid().optional().or(z.literal("")),
  remarks: optionalText,
  lines: z.array(salesOrderLineSchema).min(1, "At least one line is required"),
});

export const updateSalesOrderSchema = salesOrderSchema.extend({
  id: z.string().uuid(),
});

export const cancelDocumentSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, "Cancellation reason is required").max(500),
});

export const invoiceSchema = z.object({
  sales_order_id: z.string().uuid("Select a sales order"),
  invoice_number: z.string().trim().min(1, "Invoice number is required").max(40),
  remarks: optionalText,
  lines: z.array(
    z.object({
      sales_order_item_id: z.string().uuid(),
      quantity: qty,
      tax_amount: money.default(0),
    }),
  ).min(1, "At least one line is required"),
});

export const atwSchema = z.object({
  invoice_id: z.string().uuid("Select an invoice"),
  document_type: z.enum(["atw", "dr"]).default("atw"),
  remarks: optionalText,
  lines: z.array(
    z.object({
      invoice_item_id: z.string().uuid(),
      quantity: qty,
    }),
  ).min(1, "At least one line is required"),
});

const withdrawalSlipLineSchema = z.object({
  atw_item_id: z.string().uuid(),
  quantity: qty,
});

export const withdrawalSlipSchema = z.object({
  atw_id: z.string().uuid("Select an ATW/DR"),
  remarks: optionalText,
  lines: z.array(withdrawalSlipLineSchema).optional(),
});

export const updateWithdrawalSlipSchema = z.object({
  id: z.string().uuid(),
  remarks: optionalText,
  lines: z.array(withdrawalSlipLineSchema).optional(),
});

export const inventoryAdjustmentLineSchema = z.object({
  item_id: z.string().uuid("Select an item"),
  quantity: qty,
  direction: z.enum(["increase", "decrease"]),
});

export const inventoryAdjustmentSchema = z.object({
  remarks: optionalText,
  lines: z.array(inventoryAdjustmentLineSchema).min(1, "At least one line is required"),
});

export const updateInventoryAdjustmentSchema = inventoryAdjustmentSchema.extend({
  id: z.string().uuid(),
});

export const postInventoryAdjustmentSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, "Posting reason is required").max(500),
});
