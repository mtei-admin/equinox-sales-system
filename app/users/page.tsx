import { requirePermission } from "@/lib/auth/guards";
import { Card, PageHeader } from "@/components/page-header";
import { DataTable, EmptyState } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { InviteUserForm } from "@/components/forms/invite-user-form";
import { MasterListFilters } from "@/components/master-list-filters";
import { listProfiles } from "@/lib/data/queries";
import { hasActiveFilters, parseUserListFilters } from "@/lib/master-data/filters";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/permissions/roles";
import { inputClassName } from "@/components/form-field";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("users.manage");
  const filters = parseUserListFilters(await searchParams);
  const profiles = await listProfiles(filters);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Users"
        description="Passwords stay in Supabase Auth. Permission is the role: Admin, Sales, Warehouse, or Accounting."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <MasterListFilters
            action="/users"
            q={filters.q}
            status={filters.status}
            extra={
              <label className="w-44">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-eq-slate">Role</span>
                <select className={inputClassName} name="role" defaultValue={filters.role}>
                  <option value="all">All roles</option>
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
            }
          />
          <DataTable headers={["Name", "Username", "Role", "Status"]}>
            {profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-eq-mist/60">
                <td className="px-4 py-3">
                  <a className="text-eq-navy underline" href={`/users/${profile.id}`}>
                    {profile.full_name || "—"}
                  </a>
                </td>
                <td className="px-4 py-3">{profile.username}</td>
                <td className="px-4 py-3">{ROLE_LABELS[profile.role]}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={profile.status} />
                </td>
              </tr>
            ))}
          </DataTable>
          {profiles.length === 0 ? (
            <EmptyState
              title={filtered ? "No matching users" : "No users"}
              description={
                filtered
                  ? "Try a different search, role, or status filter."
                  : "The first Auth user becomes admin. Invite others from this page."
              }
            />
          ) : null}
        </Card>
        <InviteUserForm />
      </div>
    </>
  );
}
