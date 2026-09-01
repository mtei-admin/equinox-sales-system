import { describe, expect, it } from "vitest";
import { customerSchema, itemSchema, userAdminSchema } from "@/lib/validation/schemas";

describe("master data schemas", () => {
  it("accepts active and inactive customers and trims name", () => {
    const parsed = customerSchema.safeParse({
      name: "  Northwind  ",
      billing_address: "123 Port",
      tin_number: "000-111",
      contact_person: "Ana",
      contact_number: "123",
      status: "inactive",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Northwind");
      expect(parsed.data.status).toBe("inactive");
    }
  });

  it("rejects a customer without a name", () => {
    expect(customerSchema.safeParse({ name: "A", status: "active" }).success).toBe(false);
  });

  it("accepts catalog item updates including inactive", () => {
    const parsed = itemSchema.safeParse({
      name: "Steel pipe",
      brand: "Equinox",
      model: "SP-2",
      barcode: "EQX-1",
      serial_no: "",
      description: "Schedule 40",
      status: "inactive",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown item status", () => {
    expect(itemSchema.safeParse({ name: "Pipe", status: "discontinued" }).success).toBe(false);
  });

  it("admin user edit requires uuid, role, and status", () => {
    const parsed = userAdminSchema.safeParse({
      user_id: "00000000-0000-0000-0000-000000000001",
      full_name: "Luis Tan",
      username: "luis",
      department: "Warehouse",
      role: "warehouse",
      status: "inactive",
    });
    expect(parsed.success).toBe(true);
    expect(
      userAdminSchema.safeParse({
        user_id: "nope",
        full_name: "Luis Tan",
        username: "luis",
        role: "viewer",
        status: "active",
      }).success,
    ).toBe(false);
  });
});
