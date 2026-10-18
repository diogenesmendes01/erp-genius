import { MetricaMeta, Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirPapelLeitura } from "@/lib/guards";
import { AcessoNegado } from "@/components/AcessoNegado";
import { Botao } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { METRICA_META_LABEL } from "@/lib/labels";
import { exigirSessaoPagina } from "@/server/_shared";
import { escopoRelatorio } from "@/server/relatorios/escopo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { progressoMetas } from "@/server/metas/metas";
import { lerTexto, type ParametrosUrl } from "@/lib/pagina-url";
import { definirMeta } from "./acoes";

function competenciaAtual(fuso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}

// Metas comerciais do mês (Q9): administrador define para qualquer um e para o geral; gerente, para a equipe.
export default async function MetasPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  if (!(await exigirPapelLeitura(Papel.GERENTE_COMERCIAL))) return <AcessoNegado recurso="as metas comerciais" />;
  const usuario = await exigirSessaoPagina(Papel.GERENTE_COMERCIAL);
  const ehAdmin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const escopo = await escopoRelatorio(usuario);
  const competencia = competenciaAtual(await fusoDaEscola());
  const [progresso, vendedores] = await Promise.all([
    progressoMetas({ competencias: [competencia], escopo }),
    prisma.usuario.findMany({
      // Quem pode receber meta: o admin vê vendedores e gerentes; o gerente, a equipe e ele mesmo (a meta dele
      // também aparece na tabela e precisa do nome).
      where: ehAdmin
        ? { ativo: true, papeis: { hasSome: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] } }
        : { ativo: true, OR: [{ id: usuario.id }, { gerenteComercialId: usuario.id, papeis: { has: Papel.VENDEDOR } }] },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  const nomes = new Map(vendedores.map((v) => [v.id, v.nome]));
  const sp = (await searchParams) ?? {};
  const erro = lerTexto(sp, "erro", 200);
  const salvo = lerTexto(sp, "salvo", 1) === "1";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="text-lg font-medium">Metas de {competencia}</h2>
        {progresso.length === 0 ? (
          <EstadoVazio className="mt-2">Nenhuma meta definida para este mês.</EstadoVazio>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1">Quem</th>
                <th>Métrica</th>
                <th>Meta</th>
                <th>Realizado</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {progresso.map((p) => (
                <tr key={`${p.usuarioId}-${p.metrica}-${p.moeda}`} className="border-t border-gray-200">
                  <td className="py-1">{p.usuarioId ? (nomes.get(p.usuarioId) ?? "Pessoa inativa") : "Equipe"}</td>
                  <td>{METRICA_META_LABEL[p.metrica]}{p.moeda ? ` (${p.moeda})` : ""}</td>
                  <td>{p.meta}</td>
                  <td>{p.realizado}</td>
                  <td>{p.pct === null ? "—" : `${Math.round(p.pct * 100)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {erro && <p role="alert" className="rounded-md bg-red-100 p-3 text-sm text-red-700">Meta não salva: {erro}</p>}
      {!erro && salvo && <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">Meta salva.</p>}

      <form action={definirMeta} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-4">
        <label className="flex flex-col text-xs text-gray-500">
          Mês
          <input name="competencia" defaultValue={competencia} pattern="\d{4}-\d{2}" required className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800" />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Quem
          <select name="usuarioId" defaultValue={ehAdmin ? "" : usuario.id} className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800">
            {ehAdmin && <option value="">Equipe (geral)</option>}
            {!ehAdmin && <option value={usuario.id}>Eu</option>}
            {vendedores.filter((v) => v.id !== usuario.id).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Métrica
          <select name="metrica" className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-800">
            {Object.values(MetricaMeta).map((m) => <option key={m} value={m}>{METRICA_META_LABEL[m]}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Valor
          <input name="valor" inputMode="decimal" required className="w-28 rounded border border-gray-300 px-2 py-1 text-sm text-gray-800" />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Moeda (valor ganho)
          <input name="moeda" maxLength={3} className="w-20 rounded border border-gray-300 px-2 py-1 text-sm uppercase text-gray-800" />
        </label>
        <Botao type="submit">Salvar meta</Botao>
      </form>
    </div>
  );
}
