import type { UserRole } from "@/types/database";

export type DashboardView = {
  showFullCounts: boolean;
  showSalesDocuments: boolean;
  showWarehouseDocuments: boolean;
  showSalesPending: boolean;
  showWarehousePending: boolean;
  showActionLinks: boolean;
  showPipeline: boolean;
};

const VIEWS: Record<UserRole, DashboardView> = {
  admin: {
    showFullCounts: true,
    showSalesDocuments: true,
    showWarehouseDocuments: true,
    showSalesPending: true,
    showWarehousePending: true,
    showActionLinks: true,
    showPipeline: true,
  },
  sales: {
    showFullCounts: false,
    showSalesDocuments: true,
    showWarehouseDocuments: false,
    showSalesPending: true,
    showWarehousePending: false,
    showActionLinks: true,
    showPipeline: true,
  },
  warehouse: {
    showFullCounts: false,
    showSalesDocuments: false,
    showWarehouseDocuments: true,
    showSalesPending: false,
    showWarehousePending: true,
    showActionLinks: true,
    showPipeline: false,
  },
  accounting: {
    showFullCounts: true,
    showSalesDocuments: true,
    showWarehouseDocuments: true,
    showSalesPending: false,
    showWarehousePending: false,
    showActionLinks: false,
    showPipeline: true,
  },
};

export function dashboardViewFor(role: UserRole): DashboardView {
  return VIEWS[role];
}

export function dashboardDescription(role: UserRole) {
  switch (role) {
    case "admin":
      return "Full operational dashboard: pipeline, documents, and pending actions.";
    case "sales":
      return "Sales orders, invoices, ATW/DR, and pending actions.";
    case "warehouse":
      return "ATW/DR pending withdrawal and withdrawal slips.";
    case "accounting":
      return "Read-only transaction overview. Pending action links are hidden.";
  }
}
