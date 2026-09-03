import { notFound } from "next/navigation";
import { Card, PageHeader, SecondaryLink } from "@/components/page-header";
import { AuditFields } from "@/components/audit-fields";
import { UserEditForm } from "@/components/forms/user-edit-form";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";
import { requirePermission } from "@/lib/auth/guards";
import { getProfile } from "@/lib/data/queries";
import { ROLE_LABELS } from "@/lib/permissions/roles";

export default async function UserEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("users.manage");
  const { id } = await params;
  const user = await getProfile(id);
  if (!user) notFound();

  return (
    <>
      <PageHeader
        title={user.full_name || user.username}
        description={`${ROLE_LABELS[user.role]}. Changing role or status takes effect on the next request.`}
        actions={<SecondaryLink href="/users">Back to users</SecondaryLink>}
      />
      <UserEditForm user={user} />
      <ResetPasswordForm userId={user.id} />
      <Card className="mt-4 max-w-2xl p-5">
        <AuditFields
          createdAt={user.created_at}
          createdByName={user.created_by_name}
          updatedAt={user.updated_at}
          updatedByName={user.updated_by_name}
        />
      </Card>
    </>
  );
}
