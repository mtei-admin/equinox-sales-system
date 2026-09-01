import { describe, expect, it } from "vitest";
import {
  hasActiveFilters,
  ilikeContains,
  orIlike,
  parseMasterListFilters,
  parseUserListFilters,
} from "@/lib/master-data/filters";

describe("master list filters", () => {
  it("parses search and status from query params", () => {
    expect(parseMasterListFilters({ q: "  north  ", status: "inactive" })).toEqual({
      q: "north",
      status: "inactive",
    });
    expect(parseMasterListFilters({ q: ["pipe"], status: ["active"] })).toEqual({
      q: "pipe",
      status: "active",
    });
    expect(parseMasterListFilters({})).toEqual({ q: "", status: "all" });
    expect(parseMasterListFilters({ status: "cancelled" }).status).toBe("all");
  });

  it("parses user role filter", () => {
    expect(parseUserListFilters({ q: "ana", status: "active", role: "warehouse" })).toEqual({
      q: "ana",
      status: "active",
      role: "warehouse",
    });
    expect(parseUserListFilters({ role: "viewer" }).role).toBe("all");
  });

  it("escapes ilike wildcards and builds an or filter", () => {
    expect(ilikeContains("  100%_off  ")).toBe("%100\\%\\_off%");
    expect(ilikeContains("")).toBeNull();
    expect(orIlike(["name", "barcode"], "%pipe%")).toBe('name.ilike."%pipe%",barcode.ilike."%pipe%"');
  });

  it("detects when filters are active", () => {
    expect(hasActiveFilters({ q: "", status: "all" })).toBe(false);
    expect(hasActiveFilters({ q: "x", status: "all" })).toBe(true);
    expect(hasActiveFilters({ q: "", status: "inactive" })).toBe(true);
    expect(hasActiveFilters({ q: "", status: "all", role: "all" })).toBe(false);
    expect(hasActiveFilters({ q: "", status: "all", role: "sales" })).toBe(true);
  });
});
