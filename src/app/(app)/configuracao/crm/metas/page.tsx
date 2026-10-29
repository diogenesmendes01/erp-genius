import Link from "next/link";
import { MetricaMeta, Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Botao, botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { METRICA_META_LABEL } from "@/lib/labels";
import { exigirSessaoPagina } from "@/server/_shared";
import { escopoRelatorio } from "@/server/relatorios/escopo";
import { fusoDaEscola } from "@/server/relatorios/atendimento";
import { progressoMetas } from "@/server/metas/metas";
import { lerTexto, type ParametrosUrl } from "@/lib/pagina-url";
import { copiarMetasAnteriores, definirMeta } from "./acoes";

import { CampoCombobox } from "@/components/ui/combobox";
import { CampoSelect } from "@/components/ui/select";
import { MonthPicker } from "@/components/ui/month-picker";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function competenciaAtual(fuso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}`;
}

function deslocarCompetencia(competencia: string, delta: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function MetasPage({ searchParams }: { searchParams?: Promise<ParametrosUrl> } = {}) {
  const usuario = await exigirSessaoPagina(Papel.ADMINISTRADOR, Papel.GERENTE_COMERCIAL);
  const ehAdmin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const escopo = await escopoRelatorio(usuario);
  const sp = (await searchParams) ?? {};
  const competenciaParam = lerTexto(sp, "competencia", 7);
  const competencia = COMPETENCIA.test(competenciaParam) ? competenciaParam : competenciaAtual(await fusoDaEscola());
  const anterior = deslocarCompetencia(competencia, -1);
  const proximo = deslocarCompetencia(competencia, 1);
  const [progresso, vendedores] = await Promise.all([
    progressoMetas({ competencias: [competencia], escopo }),
    prisma.usuario.findMany({
      where: ehAdmin
        ? { ativo: true, papeis: { hasSome: [Papel.VENDEDOR, Papel.GERENTE_COMERCIAL] } }
        : { ativo: true, OR: [{ id: usuario.id }, { gerenteComercialId: usuario.id, papeis: { has: Papel.VENDEDOR } }] },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);
  const nomes = new Map(vendedores.map((v) => [v.id, v.nome]));
  const erro = lerTexto(sp, "erro", 200);
  const salvo = lerTexto(sp, "salvo", 1) === "1";
  const copiadasTexto = lerTexto(sp, "copiadas", 6);
  const copiadas = /^\d+$/.test(copiadasTexto) ? Number(copiadasTexto) : null;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="text-lg font-medium">Metas de {competencia}</h2>
          <Link href={`/configuracao/crm/metas?competencia=${anterior}`} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Mês anterior</Link>
          <form method="get" action="/configuracao/crm/metas" className="flex items-end gap-2">
            <label className="flex flex-col text-xs text-gray-500">
              Competência
              <MonthPicker name="competencia" defaultValue={competencia} required className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-800" />
            </label>
            <button type="submit" className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Ver mês</button>
          </form>
          <Link href={`/configuracao/crm/metas?competencia=${proximo}`} className={botaoClasses({ variante: "secundario", tamanho: "sm" })}>Próximo mês</Link>
        </div>
        {progresso.length === 0 ? (
          <EstadoVazio className="mt-2">Nenhuma meta definida para este mês.</EstadoVazio>
        ) : (
          <Table className="mt-2 w-full text-sm">
            <TableHeader>
              <TableRow className="text-left text-gray-500">
                <TableHead className="py-1">Quem</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Realizado</TableHead>
                <TableHead>%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {progresso.map((p) => (
                <TableRow key={`${p.usuarioId}-${p.metrica}-${p.moeda}`} className="border-t border-gray-200">
                  <TableCell className="py-1">{p.usuarioId ? (nomes.get(p.usuarioId) ?? "Pessoa inativa") : "Equipe"}</TableCell>
                  <TableCell>{METRICA_META_LABEL[p.metrica]}{p.moeda ? ` (${p.moeda})` : ""}</TableCell>
                  <TableCell>{p.meta}</TableCell>
                  <TableCell>{p.realizado}</TableCell>
                  <TableCell>{p.pct === null ? "—" : `${Math.round(p.pct * 100)}%`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {erro && <p role="alert" className="rounded-md bg-red-100 p-3 text-sm text-red-700">Meta não salva: {erro}</p>}
      {!erro && salvo && <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">Meta salva.</p>}
      {!erro && copiadas !== null && (
        <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {copiadas === 0 ? "Não havia metas no mês anterior para copiar." : `${copiadas} meta(s) copiada(s) do mês anterior.`}
        </p>
      )}

      <form action={definirMeta} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-surface p-4">
        <label className="flex flex-col text-xs text-gray-500">
          Mês
          <input name="competencia" defaultValue={competencia} pattern="\d{4}-\d{2}" required className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-800" />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Quem
          <CampoCombobox name="usuarioId" defaultValue={ehAdmin ? "" : usuario.id} className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-800" vazio={ehAdmin ? "Equipe (geral)" : undefined} opcoes={[...(!ehAdmin ? [{ valor: usuario.id, rotulo: "Eu" }] : []), ...vendedores.filter((v) => v.id !== usuario.id).map((v) => ({ valor: v.id, rotulo: v.nome }))]} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Métrica
          <CampoSelect name="metrica" className="rounded border border-gray-200 px-2 py-1 text-sm text-gray-800" defaultValue={Object.values(MetricaMeta)[0] ?? ""} opcoes={Object.values(MetricaMeta).map((m) => ({ valor: String(m), rotulo: METRICA_META_LABEL[m] }))} />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Valor
          <input name="valor" inputMode="decimal" required className="w-28 rounded border border-gray-200 px-2 py-1 text-sm text-gray-800" />
        </label>
        <label className="flex flex-col text-xs text-gray-500">
          Moeda (valor ganho)
          <input name="moeda" maxLength={3} className="w-20 rounded border border-gray-200 px-2 py-1 text-sm uppercase text-gray-800" />
        </label>
        <Botao type="submit">Salvar meta</Botao>
      </form>

      <form action={copiarMetasAnteriores}>
        <input type="hidden" name="competencia" value={competencia} />
        <Botao type="submit" variante="secundario">Copiar metas do mês anterior</Botao>
      </form>
    </div>
  );
}
