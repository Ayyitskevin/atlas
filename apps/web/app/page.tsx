import { ATLAS_PRODUCT_NAME } from "@atlas/shared";

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
            <h1 className="text-3xl font-semibold text-slate-950">{ATLAS_PRODUCT_NAME}</h1>
          </div>
          <nav className="flex gap-3 text-sm font-medium text-slate-600">
            <a href="/login">Log in</a>
            <a href="/register">Register</a>
          </nav>
        </header>

        <section className="grid gap-4 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-slate-950">Dashboard placeholder</h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            The project-management UI will be built on top of the platform foundation. This shell exists to validate
            routing, auth pages, styling, and API connectivity as the backend comes online.
          </p>
        </section>
      </div>
    </main>
  );
}
