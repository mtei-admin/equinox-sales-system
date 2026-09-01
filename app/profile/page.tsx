import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/forms/profile-form";
import { requireProfile } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/permissions/roles";

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <>
      <PageHeader
        title="My profile"
        description={`${ROLE_LABELS[profile.role]}. Passwords are stored in Supabase Auth, not on this record.`}
      />
      <ProfileForm profile={profile} />
    </>
  );
}
