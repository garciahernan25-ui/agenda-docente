import { FormLogin } from "./form";

export const metadata = { title: "Ingresar · Agenda docente" };

export default function Login() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">Agenda docente</h1>
      <p className="mb-6 text-sm text-zinc-500">Ingresá tu contraseña para seguir.</p>
      <FormLogin />
    </main>
  );
}
