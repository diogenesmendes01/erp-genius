import Link from "next/link";
import { AcessoNegado } from "@/components/AcessoNegado";
import { abasVisiveis } from "../abas";
import { BarraAbasFinanceiro } from "../BarraAbasFinanceiro";
import { carregarContextoFinanceiro, carregarFilasPendentes } from "../contexto";

// /financeiro por rota (docs/42-auditoria-frontend-ux.md, E8): o layout segura título, atalhos e a
// barra de abas; cada aba é uma página com as próprias consultas e o próprio guard. Antes, a página
// única entregava tudo a um painel que mostrava uma aba só, e todo revalidatePath reconstruía as 11.
export default async function FinanceiroPainelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await carregarContextoFinanceiro();
  if (!ctx) return <AcessoNegado recurso="o financeiro" />;
  const { permissoes } = ctx;
  const filas = await carregarFilasPendentes(permissoes);
  return (
    <div>
      {permissoes.podeOperarCobranca && (
        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
          <Link className="underline" href="/financeiro/acertos-taxa">Conferir acertos de taxa por aditivo</Link>
          <Link className="underline" href="/financeiro/acertos-cobertura">Conferir correções de cobertura por aditivo</Link>
          <Link className="underline" href="/financeiro/desistencias">Conferir desistências de matrículas</Link>
          <Link className="underline" href="/financeiro/recebimentos">Registrar recebimento com destinações</Link>
          <Link className="underline" href="/financeiro/migracao">Conferir conciliação da migração</Link>
          <Link className="underline" href="/financeiro/continuidade">Acompanhar continuidade mensal</Link>
        </div>
      )}
      <h1 className="mb-3 text-2xl font-medium">Financeiro</h1>
      <BarraAbasFinanceiro
        abas={abasVisiveis(permissoes)}
        contagem={{
          informes: filas.informes.length,
          retomadas: filas.retomadas.filter((p) => p.status === "PENDENTE").length,
          aprovacoes: filas.aprovacoes.length,
        }}
      />
      {children}
    </div>
  );
}
