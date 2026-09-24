"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ReguaComercialConfig,
  EnsaioComercial,
  NumeroResumo,
  TemplateResumo,
} from "@/server/comercial/consultas";
import { salvarReguaComercial } from "@/server/comercial/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { buscarVinculosInbox } from "@/server/whatsapp/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { executarAcaoCliente, useAcaoCliente } from "@/lib/acao-cliente";
import { criarBuscaMaisRecente } from "@/lib/busca-recente";
import { botaoClasses } from "@/components/Botao";

// RÉGUA COMERCIAL "lead novo sem resposta" (doc 27 C1). Nasce desligada; a ordem dos passos
// é fixa (lei de código), a UI edita offset/ativo/template + estado + remetente + janela.

const btnPri = botaoClasses({ tamanho: "md" });
const inputCls = "rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-brand-500";

interface DegrauForm {
  passo: string;
  offsetMinutos: number;
  rotulo: string;
  ativo: boolean;
  templateId: string;
}

/** Uma seção por cenário (lead-novo, pré-experimental, no-show — doc 27 C1/C2). */
export function ReguasComerciaisPainel({
  reguas,
  numeros,
  templates,
  ensaio,
  preferenciaFusoExibicao = null,
}: {
  reguas: ReguaComercialConfig[];
  numeros: NumeroResumo[];
  templates: TemplateResumo[];
  ensaio: EnsaioComercial[];
  preferenciaFusoExibicao?: string | null;
}) {
  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-lg font-medium">Réguas comerciais</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cadências automáticas do funil. Todas começam desligadas; em ensaio (shadow) só registram o que teria
          sido enviado. O envio passa pela mesma fila e pelos mesmos guard-rails da cobrança.
        </p>
      </div>
      {reguas.map((r) => (
        <ReguaComercialPainel key={r.chave} regua={r} numeros={numeros} templates={templates} />
      ))}
      <EnsaioComercialLista ensaio={ensaio} preferenciaFusoExibicao={preferenciaFusoExibicao} />
    </section>
  );
}

function ReguaComercialPainel({
  regua,
  numeros,
  templates,
}: {
  regua: ReguaComercialConfig;
  numeros: NumeroResumo[];
  templates: TemplateResumo[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(regua.estado);
  const [numeroRemetenteId, setRemetente] = useState(regua.numeroRemetenteId ?? "");
  const [janelaInicio, setJanelaInicio] = useState(regua.janelaInicio);
  const [janelaFim, setJanelaFim] = useState(regua.janelaFim);
  const [tetoPorContatoDia, setTeto] = useState(regua.tetoPorContatoDia);
  const [degraus, setDegraus] = useState<DegrauForm[]>(
    regua.degraus.map((d) => ({ ...d, templateId: d.templateId ?? "" })),
  );
  // B1 (doc 32): cohort do piloto — allowlist explícita; desligar o modo piloto é go-live.
  const [modoPiloto, setModoPiloto] = useState(regua.modoPiloto);
  const [pilotoLeads, setPilotoLeads] = useState(regua.pilotoLeads);
  const [buscaPiloto, setBuscaPiloto] = useState("");
  const [opcoesPiloto, setOpcoesPiloto] = useState<{ id: string; nome: string; codigo: string | null }[]>([]);
  // Um estado por régua: o resultado aparece sob o botão da régua salva. salvarReguaComercial não
  // recebe chave de idempotência: resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  const [buscaPilotoRecente] = useState(criarBuscaMaisRecente);
  // Saiu da tela: a busca em voo é invalidada e sua resposta não grava mais estado.
  useEffect(() => () => buscaPilotoRecente.cancelar(), [buscaPilotoRecente]);

  const numerosVendas = numeros.filter((n) => n.finalidade === "VENDAS");

  function editarDegrau(i: number, patch: Partial<DegrauForm>) {
    setDegraus((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  async function buscarLeadsPiloto(q: string) {
    setBuscaPiloto(q);
    if (q.trim().length < 2) {
      buscaPilotoRecente.cancelar(); // uma resposta de antes não pode repovoar a lista já limpa
      return setOpcoesPiloto([]);
    }
    // Busca só-leitura a cada tecla: fora do useAcaoCliente (a trava de duplo clique descartaria as
    // teclas seguintes). Só a resposta da busca mais recente vale — "an" não sobrescreve "ana".
    const r = await buscaPilotoRecente.buscar(() => executarAcaoCliente(() => buscarVinculosInbox(q), { idempotente: false }));
    if (!r.atual) return;
    const d = r.valor;
    // Falha (de negócio ou de rede) limpa as sugestões: as da busca anterior não correspondem ao texto atual.
    if (d.tipo !== "ok" || !d.dado) return setOpcoesPiloto([]);
    const jaNaLista = new Set(pilotoLeads.map((l) => l.id));
    setOpcoesPiloto(d.dado.leads.filter((l) => !jaNaLista.has(l.id)));
  }

  function adicionarLeadPiloto(l: { id: string; nome: string; codigo: string | null }) {
    setPilotoLeads((ls) => (ls.some((x) => x.id === l.id) ? ls : [...ls, l]));
    setBuscaPiloto("");
    setOpcoesPiloto([]);
  }

  function alternarModoPiloto(ligado: boolean) {
    // Desligar o piloto = GO-LIVE GERAL (todos os leads elegíveis do número) — nunca por
    // clique distraído (B1).
    if (!ligado && !window.confirm(
      "Desligar o modo piloto faz esta cadência alcançar TODOS os leads elegíveis do número (go-live geral). Confirmar?",
    )) return;
    setModoPiloto(ligado);
  }

  async function salvar() {
    const desfecho = await acao.executar(() => salvarReguaComercial({
      chave: regua.chave,
      estado,
      numeroRemetenteId,
      janelaInicio,
      janelaFim,
      tetoPorContatoDia,
      modoPiloto,
      pilotoLeadIds: pilotoLeads.map((l) => l.id),
      degraus: degraus.map((d) => ({
        passo: d.passo,
        offsetMinutos: d.offsetMinutos,
        ativo: d.ativo,
        templateId: d.templateId,
      })),
    }), `Régua "${regua.nome}" salva.`);
    if (desfecho?.tipo === "ok") router.refresh();
  }

  return (
    <div>
      <div className="mb-2">
        <h3 className="text-sm font-medium">{regua.nome}</h3>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-surface p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Estado</span>
            <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)}>
              <option value="DESLIGADA">Desligada</option>
              <option value="SHADOW">Ensaio (shadow) — não envia</option>
              <option value="ATIVA">Ativa — envia</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Número remetente (vendas)</span>
            <select className={inputCls} value={numeroRemetenteId} onChange={(e) => setRemetente(e.target.value)}>
              <option value="">—</option>
              {numerosVendas.map((n) => (
                <option key={n.id} value={n.id}>{n.rotulo}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Janela (h)</span>
            <span className="flex items-center gap-1">
              <input type="number" min={0} max={23} aria-label="Janela: início (h)" className={inputCls + " w-16"} value={janelaInicio} onChange={(e) => setJanelaInicio(Number(e.target.value))} />
              <span className="text-gray-400">às</span>
              <input type="number" min={1} max={24} aria-label="Janela: fim (h)" className={inputCls + " w-16"} value={janelaFim} onChange={(e) => setJanelaFim(Number(e.target.value))} />
            </span>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-600">Teto/dia</span>
            <input type="number" min={1} max={10} className={inputCls + " w-16"} value={tetoPorContatoDia} onChange={(e) => setTeto(Number(e.target.value))} />
          </label>
        </div>

        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Degrau</th>
                <th className="px-3 py-2 text-left">Após (min)</th>
                <th className="px-3 py-2 text-left">Template</th>
                <th className="px-3 py-2 text-left">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {degraus.map((d, i) => (
                <tr key={d.passo} className="border-t border-gray-100">
                  <td className="px-3 py-2">{d.rotulo}</td>
                  <td className="px-3 py-2">
                    {/* Negativo = ANTES da âncora (pré-experimental: -1440, -120). */}
                    <input type="number" min={-43200} max={43200} aria-label={`${d.rotulo} — após (min)`} className={inputCls + " w-24"} value={d.offsetMinutos} onChange={(e) => editarDegrau(i, { offsetMinutos: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <select aria-label={`${d.rotulo} — template`} className={inputCls} value={d.templateId} onChange={(e) => editarDegrau(i, { templateId: e.target.value })}>
                      <option value="">(texto de fábrica)</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="checkbox" aria-label={`${d.rotulo} — ativo`} className="h-4 w-4 accent-brand-600" checked={d.ativo} onChange={(e) => editarDegrau(i, { ativo: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* B1 (doc 32): cohort do piloto */}
        <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={modoPiloto}
                onChange={(e) => alternarModoPiloto(e.target.checked)}
              />
              Modo piloto (cohort restrito)
            </label>
            <span className="text-xs text-gray-500">
              {modoPiloto
                ? `Só os ${pilotoLeads.length} lead(s) da lista recebem esta cadência.`
                : "GO-LIVE GERAL: todos os leads elegíveis do número recebem."}
            </span>
          </div>
          {modoPiloto && (
            <div className="mt-2 space-y-2">
              {pilotoLeads.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Lista vazia = ninguém recebe. Adicione os leads do piloto abaixo.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1">
                  {pilotoLeads.map((l) => (
                    <li key={l.id} className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {l.codigo ? `${l.codigo} · ` : ""}{l.nome}
                      <button
                        aria-label={`Remover ${l.nome} do piloto`}
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setPilotoLeads((ls) => ls.filter((x) => x.id !== l.id))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="relative">
                <input
                  className={inputCls + " w-64"}
                  aria-label="Buscar lead para adicionar ao piloto"
                  placeholder="Buscar lead por nome…"
                  value={buscaPiloto}
                  onChange={(e) => buscarLeadsPiloto(e.target.value)}
                />
                {opcoesPiloto.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-64 rounded-md border border-gray-200 bg-surface">
                    {opcoesPiloto.map((l) => (
                      <li key={l.id}>
                        <button
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                          onClick={() => adicionarLeadPiloto(l)}
                        >
                          {l.codigo ? `${l.codigo} · ` : ""}{l.nome}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <button className={btnPri} disabled={acao.ocupado} onClick={salvar}>
          {acao.ocupado ? "Salvando…" : `Salvar "${regua.nome}"`}
        </button>
        <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      </div>
    </div>
  );
}

/** Ensaio observável (doc 27 §regra de ouro): o que as cadências TERIAM enviado. */
function EnsaioComercialLista({ ensaio, preferenciaFusoExibicao = null }: { ensaio: EnsaioComercial[]; preferenciaFusoExibicao?: string | null }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">Ensaio — últimos follow-ups simulados</div>
      {ensaio.length === 0 ? (
        <p className="text-sm text-gray-500">Nada simulado ainda. Em ensaio, cada degrau devido registra aqui o que teria sido enviado.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-surface">
          {ensaio.map((e) => (
            <li key={e.id} className="px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-gray-800">{e.lead} · {e.passo}</span>
                <span className="shrink-0 text-xs text-gray-400">{(() => {
                  const exibicao = formatarInstanteExibicao(e.quando, preferenciaFusoExibicao, "UTC");
                  return `${exibicao.texto} (${exibicao.fuso}; origem UTC)`;
                })()}</span>
              </div>
              <p className="mt-0.5 text-gray-600">{e.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
