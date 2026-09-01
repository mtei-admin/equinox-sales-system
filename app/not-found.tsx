import { Card } from "@/components/page-header";
import { SecondaryLink } from "@/components/page-header";

export default function NotFound() {
  return (
    <Card className="mx-auto mt-16 max-w-lg p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-eq-amber">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-eq-ink">Record not found</h1>
      <p className="mt-2 text-sm text-eq-slate">The document may have been removed or the link is incorrect.</p>
      <div className="mt-6">
        <SecondaryLink href="/dashboard">Back to dashboard</SecondaryLink>
      </div>
    </Card>
  );
}
