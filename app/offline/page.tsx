export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-eq-mist px-6">
      <div className="max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-eq-amber">Equinox</p>
        <h1 className="mt-2 text-2xl font-semibold text-eq-ink">You are offline</h1>
        <p className="mt-2 text-sm text-eq-slate">
          Sales orders, invoices, and stock stay on the server. Reconnect, then open Equinox again.
        </p>
      </div>
    </main>
  );
}
