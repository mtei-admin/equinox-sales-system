import { describe, expect, it } from "vitest";
import { dashboardViewFor, dashboardDescription } from "@/lib/reports/roles";
import { ALL_ROLES } from "@/lib/permissions/roles";

describe("role-specific dashboards", () => {
  it("gives admin the full operational dashboard", () => {
    expect(dashboardViewFor("admin")).toEqual({
      showFullCounts: true,
      showSalesDocuments: true,
      showWarehouseDocuments: true,
      showSalesPending: true,
      showWarehousePending: true,
      showActionLinks: true,
      showPipeline: true,
    });
  });

  it("limits sales to orders, invoices, ATW/DR, and pending actions", () => {
    const view = dashboardViewFor("sales");
    expect(view.showSalesDocuments).toBe(true);
    expect(view.showSalesPending).toBe(true);
    expect(view.showWarehouseDocuments).toBe(false);
    expect(view.showWarehousePending).toBe(false);
    expect(view.showActionLinks).toBe(true);
  });

  it("limits warehouse to ATW/DR pending withdrawal and withdrawal slips", () => {
    const view = dashboardViewFor("warehouse");
    expect(view.showWarehouseDocuments).toBe(true);
    expect(view.showWarehousePending).toBe(true);
    expect(view.showSalesDocuments).toBe(false);
    expect(view.showSalesPending).toBe(false);
    expect(view.showFullCounts).toBe(false);
  });

  it("gives accounting a read-only overview with no pending action links", () => {
    const view = dashboardViewFor("accounting");
    expect(view.showFullCounts).toBe(true);
    expect(view.showPipeline).toBe(true);
    expect(view.showSalesDocuments).toBe(true);
    expect(view.showWarehouseDocuments).toBe(true);
    expect(view.showSalesPending).toBe(false);
    expect(view.showWarehousePending).toBe(false);
    expect(view.showActionLinks).toBe(false);
  });

  it("describes each role’s dashboard", () => {
    expect(dashboardDescription("admin")).toContain("Full");
    expect(dashboardDescription("sales")).toContain("pending actions");
    expect(dashboardDescription("warehouse")).toContain("pending withdrawal");
    expect(dashboardDescription("accounting")).toContain("Read-only");
  });

  it("covers every role", () => {
    for (const role of ALL_ROLES) {
      expect(dashboardViewFor(role).showActionLinks || role === "accounting").toBe(true);
    }
  });
});
