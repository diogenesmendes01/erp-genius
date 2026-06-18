import { auth } from "@/lib/auth";
import { PAPEL_LABEL } from "@/lib/roles";
import type { Papel } from "@prisma/client";

export default async function HomePage() {
  const session = await auth();
  const papeis = (session?.user?.papeis as Papel[] | undefined) ?? [];

  return (
    <div>
      <h1 className="text-2xl font-medium">Olá, {session?.user?.name}</h1>
      <p className="mt-2 text-gray-600">Bem-vindo ao ERP Genius.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {papeis.map((p) => (
          <span
            key={p}
            className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
          >
            {PAPEL_LABEL[p] ?? p}
          </span>
        ))}
      </div>

      <p className="mt-8 max-w-xl text-sm text-gray-500">
        O menu à esquerda mostra apenas as seções que o seu papel pode acessar. As telas serão
        montadas a partir do design em <code>docs/09-fase0-telas.md</code>.
      </p>
    </div>
  );
}
