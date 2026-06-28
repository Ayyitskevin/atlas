export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-8">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-950">Create your Atlas account</h1>
        <form className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Name
            <input className="rounded-md border border-slate-300 px-3 py-2" name="name" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Email
            <input className="rounded-md border border-slate-300 px-3 py-2" name="email" type="email" />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Password
            <input className="rounded-md border border-slate-300 px-3 py-2" name="password" type="password" />
          </label>
          <button className="rounded-md bg-slate-950 px-4 py-2 font-semibold text-white" type="submit">
            Register
          </button>
        </form>
      </section>
    </main>
  );
}
