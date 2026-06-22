import { redirect } from "next/navigation";
import Link from "next/link";
import { Papel } from "@prisma/client";
import { auth } from "@/lib/auth";
import { navParaPapeis } from "@/lib/nav";
import { dadosHomeVendedor, dadosHomeGerente, dadosHomeProfessor } from "@/server/home/consultas";
import { HomeVendedor } from "./HomeVendedor";
import { HomeGerente } from "./HomeGerente";
import { HomeProfessor } from "./HomeProfessor";
import type { UsuarioSessao } from "@/server/_shared";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const usuario: UsuarioSessao = {
    id: session.user.id,
    nome: session.user.name ?? "Usuário",
    papeis: (session.user.papeis ?? []) as Papel[],
  };

  const ehGerente =
    usuario.papeis.includes(Papel.ADMINISTRADOR) ||
    usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  const ehVendedor = usuario.papeis.includes(Papel.VENDEDOR);

  if (ehGerente) {
    const dados = await dadosHomeGerente();
    return <HomeGerente nome={usuario.nome} dados={dados} />;
  }
  if (ehVendedor) {
    const dados = await dadosHomeVendedor(usuario);
    return <HomeVendedor nome={usuario.nome} dados={dados} />;
  }
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    const dados = await dadosHomeProfessor(usuario);
    return <HomeProfessor nome={usuario.nome} turmas={dados.turmas} experimentais={dados.experimentais} />;
  }

  // Home genérica para os demais papéis (Secretaria, Financeiro, Pedagógico, Professor).
  const itens = navParaPapeis(usuario.papeis).filter((i) => i.href !== "/home");
  return (
    <div>
      <h1 className="text-2xl font-medium">Olá, {usuario.nome.split(" ")[0]}</h1>
      <p className="mt-2 text-sm text-gray-500">Acesso rápido às suas áreas:</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {itens.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="rounded-lg border border-gray-200 bg-surface px-4 py-3 text-sm font-medium text-gray-700 hover:border-brand-300 hover:bg-brand-50"
          >
            {i.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
