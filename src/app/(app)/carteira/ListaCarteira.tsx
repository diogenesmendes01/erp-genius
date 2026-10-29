"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao, botaoClasses } from "@/components/Botao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ETAPA_LABEL } from "@/lib/labels";
import { Checkbox } from "@/components/ui/checkbox";
import { CampoCombobox } from "@/components/ui/combobox";
import { CampoSelect } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { reatribuirCarteiraEmLote } from "@/server/crm/carteira-acoes";
import { MAX_LOTE_CARTEIRA, TEXTO_CONSEQUENCIA_REATRIBUICAO, type FiltrosCarteira, type LinhaCarteira, type VendedorCarteira } from "./modelo";

const MAX_LOTE = MAX_LOTE_CARTEIRA;
const CAIXA = "flex h-11 w-11 items-center justify-center";
const CONTROLE = "rounded-md border border-border-soft bg-surface-raised px-2 text-sm min-h-11 sm:min-h-9";

export function ConsequenciaReatribuicao({ quantidade, para }: { quantidade?: number; para?: string }) {
  return (
    <>
      {quantidade !== undefined && para !== undefined && (
        <p>
          {quantidade === 1 ? "1 oportunidade passa" : `${quantidade} oportunidades passam`} para {para}.
        </p>
      )}
      <p>{TEXTO_CONSEQUENCIA_REATRIBUICAO}</p>
      <p>Não há desfazer pela tela: para devolver, é preciso reatribuir de novo.</p>
    </>
  );
}

export function recusadasComNome(
  recusadas: { id: string; motivo: string }[],
  linhas: Pick<LinhaCarteira, "oportunidadeId" | "nome">[],
): { id: string; nome: string; motivo: string }[] {
  const nomes = new Map(linhas.map((l) => [l.oportunidadeId, l.nome]));
  return recusadas.map((r) => ({ ...r, nome: nomes.get(r.id) ?? "Oportunidade" }));
}

export function idsParaSelecionarTodas(linhas: Pick<LinhaCarteira, "oportunidadeId">[]): string[] {
  return linhas.slice(0, MAX_LOTE).map((l) => l.oportunidadeId);
}

export function avisoLimiteLote(selecionados: number, linhas: number): { texto: string; bloqueia: boolean } | null {
  if (selecionados > MAX_LOTE) {
    return { texto: `O lote aceita no máximo ${MAX_LOTE} oportunidades por vez; desmarque ${selecionados - MAX_LOTE}.`, bloqueia: true };
  }
  if (selecionados === MAX_LOTE && linhas > MAX_LOTE) {
    return { texto: `O lote aceita no máximo ${MAX_LOTE} oportunidades por vez; as demais ficam para o próximo lote.`, bloqueia: false };
  }
  return null;
}

export function textoConclusaoLote({ feitas, jaEram }: { feitas: number; jaEram: number }): string {
  const mudaram = feitas === 1 ? "1 oportunidade reatribuída." : `${feitas} oportunidades reatribuídas.`;
  if (jaEram === 0) return mudaram;
  return `${mudaram} ${jaEram === 1 ? "1 já era do novo responsável." : `${jaEram} já eram do novo responsável.`}`;
}

function textoDias(dias: number): string {
  if (dias <= 0) return "Hoje";
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

type Props = {
  linhas: LinhaCarteira[];
  vendedores: VendedorCarteira[];
  total: number;
  filtros: FiltrosCarteira;
  podeReatribuir: boolean;
  filtrando: boolean;
};

export function ListaCarteira({ linhas, vendedores, total, filtros, podeReatribuir, filtrando }: Props) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [destino, setDestino] = useState("");
  const [emTurma, setEmTurma] = useState(filtros.emTurma);
  const [motivo, setMotivo] = useState("");
  const acao = useAcaoCliente({ idempotente: false });
  const [confirmando, setConfirmando] = useState(false);
  const [recusadas, setRecusadas] = useState<{ id: string; nome: string; motivo: string }[]>([]);

  const marcados = new Set(selecionados);
  const paraTodas = idsParaSelecionarTodas(linhas);
  const todos = paraTodas.length > 0 && paraTodas.every((id) => marcados.has(id));
  const aviso = avisoLimiteLote(selecionados.length, linhas.length);
  const alternar = (id: string) => setSelecionados((atual) => (atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]));
  const nomeDestino = vendedores.find((v) => v.id === destino)?.nome ?? "";

  function pedirConfirmacao() {
    acao.limpar();
    setRecusadas([]);
    if (selecionados.length > MAX_LOTE) return acao.setErro(`Selecione no máximo ${MAX_LOTE} oportunidades por vez.`);
    if (!destino) return acao.setErro("Escolha o novo responsável.");
    const m = motivo.trim();
    if (m.length < 5) return acao.setErro("Informe o motivo (mínimo 5 caracteres).");
    if (m.length > 1000) return acao.setErro("O motivo deve ter no máximo 1.000 caracteres.");
    acao.setErro(null);
    setConfirmando(true);
  }

  function concluido(dado: { feitas: number; jaEram: number; recusadas: { id: string; motivo: string }[] } | undefined) {
    setConfirmando(false);
    setSelecionados([]);
    setMotivo("");
    setDestino("");
    setRecusadas(recusadasComNome(dado?.recusadas ?? [], linhas));
    acao.setSucesso(textoConclusaoLote({ feitas: dado?.feitas ?? 0, jaEram: dado?.jaEram ?? 0 }));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form method="get" action="/carteira" className="flex flex-wrap items-end gap-3" aria-label="Filtros da carteira">
        <label className="grid gap-1 text-sm">
          Busca
          <input name="busca" defaultValue={filtros.busca} maxLength={100} placeholder="Nome ou código" className={CONTROLE} />
        </label>
        <label className="grid gap-1 text-sm">
          Vendedor
          <CampoCombobox name="dono" defaultValue={filtros.donoId} vazio="Todos" opcoes={vendedores.map((v) => ({ valor: v.id, rotulo: `${v.nome} (${v.total})` }))} />
        </label>
        <label className="grid gap-1 text-sm">
          Tipo
          <CampoSelect name="tipo" defaultValue={filtros.tipo} opcoes={[{ valor: "todos", rotulo: "Todos" }, { valor: "pf", rotulo: "Pessoa física" }, { valor: "pj", rotulo: "Empresa" }]} />
        </label>
        <label className="grid gap-1 text-sm">
          Sem interação
          <CampoCombobox name="semInteracao" defaultValue={filtros.semInteracaoDias} vazio="Qualquer prazo" opcoes={[{ valor: "7", rotulo: "Há 7 dias ou mais" }, { valor: "15", rotulo: "Há 15 dias ou mais" }, { valor: "30", rotulo: "Há 30 dias ou mais" }]} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:min-h-9">
          <Checkbox name="emTurma" value="1" checked={emTurma} onCheckedChange={(v) => setEmTurma(v === true)} />
          Só quem já está em turma
        </label>
        <button className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Filtrar</button>
      </form>

      <FeedbackAcao erro={null} sucesso={acao.sucesso} />
      {recusadas.length > 0 && (
        <ul className="space-y-1 text-sm text-red-700" aria-label="Oportunidades não reatribuídas">
          {recusadas.map((r) => (
            <li key={r.id}>{r.nome}: {r.motivo}</li>
          ))}
        </ul>
      )}

      {linhas.length === 0 ? (
        <EstadoVazio bloco acao={filtrando ? <Link href="/carteira" className={botaoClasses({ variante: "secundario", tamanho: "md" })}>Limpar filtros</Link> : undefined}>
          {filtrando ? "Nenhuma oportunidade com esses filtros." : "Nenhuma oportunidade na carteira."}
        </EstadoVazio>
      ) : (
        <>
          <p className="text-xs text-gray-500">
            {linhas.length < total ? `Mostrando ${linhas.length} de ${total} oportunidades; refine os filtros para ver as demais.` : total === 1 ? "1 oportunidade." : `${total} oportunidades.`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <Table>
              <TableHeader className="bg-surface-muted text-xs text-gray-600">
                <TableRow className="hover:bg-transparent">
                  {podeReatribuir && (
                    <TableHead scope="col" className="w-11 px-1 py-0">
                      <label className={CAIXA}>
                        <Checkbox
                          aria-label={linhas.length > MAX_LOTE ? `Selecionar as primeiras ${MAX_LOTE} oportunidades` : "Selecionar todas as oportunidades"}
                          checked={todos}
                          onCheckedChange={() => setSelecionados(todos ? [] : paraTodas)}
                        />
                      </label>
                    </TableHead>
                  )}
                  <TableHead scope="col" className="px-4 py-2 font-medium">Oportunidade</TableHead>
                  <TableHead scope="col" className="px-4 py-2 font-medium">Etapa</TableHead>
                  <TableHead scope="col" className="px-4 py-2 font-medium">Responsável</TableHead>
                  <TableHead scope="col" className="px-4 py-2 font-medium">Sem interação</TableHead>
                  <TableHead scope="col" className="px-4 py-2 font-medium">Turma</TableHead>
                  <TableHead scope="col" className="px-4 py-2 font-medium">Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.oportunidadeId}>
                    {podeReatribuir && (
                      <TableCell className="px-1 py-0">
                        <label className={CAIXA}>
                          <Checkbox aria-label={`Selecionar ${l.nome}`} checked={marcados.has(l.oportunidadeId)} onCheckedChange={() => alternar(l.oportunidadeId)} />
                        </label>
                      </TableCell>
                    )}
                    <TableCell className="px-4 py-2">
                      <Link href={`/funil?o=${l.oportunidadeId}`} className="font-medium text-brand-700 hover:underline max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">{l.nome}</Link>
                      <span className="block text-xs text-gray-600">{l.tipo === "pj" ? "Empresa" : "Pessoa física"}</span>
                    </TableCell>
                    <TableCell className="px-4 py-2">{ETAPA_LABEL[l.etapa]}</TableCell>
                    <TableCell className="px-4 py-2">{l.dono?.nome ?? "Sem responsável"}</TableCell>
                    <TableCell className={"px-4 py-2 " + (l.diasSemInteracao >= 15 ? "text-red-700" : "")}>{textoDias(l.diasSemInteracao)}</TableCell>
                    <TableCell className="px-4 py-2">{l.turmaAtiva ?? "—"}</TableCell>
                    <TableCell className="px-4 py-2">
                      {l.tags.length === 0 ? "—" : l.tags.map((t) => (
                        <span key={t.id} className="mr-1 inline-flex rounded-full bg-brand-bg px-2 py-0.5 text-xs text-brand-800">{t.nome}</span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {podeReatribuir && selecionados.length > 0 && (
        <section
          role="region"
          aria-label="Mudar responsável"
          className="sticky bottom-0 z-30 space-y-2 rounded-lg border border-border-soft bg-surface-raised p-3 shadow-popover max-sm:fixed max-sm:inset-x-0 max-sm:rounded-b-none max-sm:rounded-t-dialog max-sm:p-4"
        >
          <p className="text-sm font-medium">{selecionados.length === 1 ? "1 oportunidade selecionada" : `${selecionados.length} oportunidades selecionadas`}</p>
          {aviso && <p role={aviso.bloqueia ? "alert" : "status"} className={"text-sm " + (aviso.bloqueia ? "text-red-700" : "text-gray-600")}>{aviso.texto}</p>}
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              Novo responsável
              <CampoCombobox value={destino} onValueChange={setDestino} vazio="Selecione" placeholder="Selecione" opcoes={vendedores.map((v) => ({ valor: v.id, rotulo: v.nome }))} />
            </label>
            <label className="grid min-w-48 flex-1 gap-1 text-sm">
              Motivo
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} minLength={5} maxLength={1000} className={CONTROLE} />
            </label>
            <Botao tamanho="lg" onClick={pedirConfirmacao} disabled={aviso?.bloqueia}>Mudar responsável</Botao>
            <Botao variante="fantasma" tamanho="lg" onClick={() => { setSelecionados([]); acao.setErro(null); }}>Limpar seleção</Botao>
          </div>
          <FeedbackAcao erro={acao.erro} />
        </section>
      )}

      {confirmando && (
        <ConfirmarAcao
          titulo={`Mudar o responsável para ${nomeDestino}?`}
          confirmacao="mudança de responsável"
          idempotente={false}
          acao={() => reatribuirCarteiraEmLote({ ids: selecionados, vendedorId: destino, motivo: motivo.trim() })}
          aoConcluir={concluido}
          aoCancelar={() => setConfirmando(false)}
        >
          <ConsequenciaReatribuicao quantidade={selecionados.length} para={nomeDestino} />
        </ConfirmarAcao>
      )}
    </div>
  );
}
