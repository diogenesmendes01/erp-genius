"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { EtapaLead, Segmento, Temperatura, MotivoPerda, CategoriaDocumento } from "@prisma/client";
import { UploadArquivo } from "@/components/UploadArquivo";
import { anexarDocumentoLead, arquivarDocumentoLead } from "@/server/comercial/acoes";
import { CopilotoSugestoes } from "@/components/CopilotoSugestoes";
import { registrarLinkPagamento } from "@/server/matricula/acoes";
import type { SugestaoPendente } from "@/server/ia/consultas";
import {
  ETAPA_LABEL,
  SEGMENTO_LABEL,
  TEMPERATURA_LABEL,
  TEMPERATURA_CLS,
  MOTIVO_PERDA_LABEL,
} from "@/lib/labels";
import { ETAPAS_MANUAIS } from "@/server/comercial/schema";
import {
  moverEtapa,
  registrarInteracao,
  agendarExperimental,
  enviarProposta,
  marcarPerdido,
  atualizarResumo,
  atualizarDatas,
} from "@/server/comercial/acoes";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";

const TRILHA: EtapaLead[] = [
  EtapaLead.NOVO,
  EtapaLead.EM_ATENDIMENTO,
  EtapaLead.QUALIFICADO,
  EtapaLead.EXPERIMENTAL_AGENDADA,
  EtapaLead.EXPERIMENTAL_REALIZADA,
  EtapaLead.PROPOSTA,
  EtapaLead.AGUARDANDO_MATRICULA,
  EtapaLead.MATRICULADO,
];

export interface LeadFicha {
  id: string;
  codigo: string | null;
  nome: string;
  telefoneE164: string | null;
  etapa: EtapaLead;
  segmento: Segmento;
  temperatura: Temperatura;
  b2b: boolean;
  criadoEm: string;
  pais: { nome: string } | null;
  vendedor: { nome: string } | null;
  origemCampanha: string | null;
  waReferralHeadline?: string | null;
  waReferralSourceType?: string | null;
  /** Lead nasceu de inbound do WhatsApp (auto-captura C1). */
  capturadoViaWhatsApp?: boolean;
  origemAnuncio: string | null;
  interesse: string | null;
  objetivo: string | null;
  urgencia: string | null;
  orcamento: string | null;
  objecao: string | null;
  proximaAcao: string | null;
  proximoFollowUp: string | null;
  dataExperimental: string | null;
  dataProposta: string | null;
  motivoPerda: MotivoPerda | null;
  matricula: {
    id: string;
    codigo: string | null;
    status: string;
    contratoOk: boolean;
    contratoEnviadoEm: string | null;
    taxa: { id: string; status: string; linkPagamento: string | null; linkEnviadoEm: string | null } | null;
  } | null;
  valorPrevisto: number | null;
  planoPrevisto: string | null;
  comissaoPrevista: number | null;
  documentos: { id: string; categoria: string; nome: string; url: string }[];
  professorExperimentalId: string | null;
}

export interface EventoTimeline {
  id: string;
  tipo: string;
  payload: unknown;
  criadoEm: string;
  autor: { nome: string } | null;
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
const btnPri =
  "rounded-md bg-brand-solid px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60";
const btnSec =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50";

function diasNoFunil(criadoEm: string): number {
  const ms = Date.now() - new Date(criadoEm).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function soData(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

// Converte um ISO (UTC) para o valor de <input type="datetime-local"> em HORA LOCAL:
// "YYYY-MM-DDTHH:mm". Mantém o horário já agendado da experimental visível/editável (issue #16).
function soDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function FichaLead({
  lead,
  timeline,
  professores = [],
  preferenciaFusoExibicao,
  sugestoesIA = [],
  copilotoAtivo = false,
}: {
  lead: LeadFicha;
  timeline: EventoTimeline[];
  professores?: { id: string; nome: string }[];
  preferenciaFusoExibicao: string | null;
  sugestoesIA?: SugestaoPendente[];
  copilotoAtivo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{lead.nome}</h1>
          <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + TEMPERATURA_CLS[lead.temperatura]}>
            {TEMPERATURA_LABEL[lead.temperatura]}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {SEGMENTO_LABEL[lead.segmento]}
          </span>
          {lead.b2b && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">B2B</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {lead.codigo} · {lead.telefoneE164 ?? "sem telefone"} · {lead.pais?.nome ?? "sem país"} ·
          no funil há {diasNoFunil(lead.criadoEm)}d · dono: {lead.vendedor?.nome ?? "—"}
        </p>
        {(lead.origemCampanha || lead.origemAnuncio) ? (
          <p className="mt-1 text-xs text-gray-400">
            Origem: {lead.origemCampanha ?? "—"} {lead.origemAnuncio ? `· ${lead.origemAnuncio}` : ""}
          </p>
        ) : lead.waReferralHeadline || lead.waReferralSourceType ? (
          <p className="mt-1 text-xs text-gray-400">
            Origem: {lead.waReferralSourceType === "ad" ? "anúncio" : lead.waReferralSourceType ?? "referral"}
            {lead.waReferralHeadline ? ` · ${lead.waReferralHeadline}` : ""} (click-to-WhatsApp)
          </p>
        ) : lead.capturadoViaWhatsApp ? (
          // B6 (doc 32): no Baileys o referral de anúncio não é garantido — a origem é
          // declarada como NÃO IDENTIFICADA (nunca inferida) até o preenchimento manual.
          <p className="mt-1 text-xs text-gray-400">Origem: não identificada (WhatsApp)</p>
        ) : null}

        {/* Trilha de estágios */}
        <div className="mt-3 flex flex-wrap gap-1">
          {TRILHA.map((e) => (
            <span
              key={e}
              className={
                "rounded px-2 py-0.5 text-xs " +
                (e === lead.etapa
                  ? "bg-brand-600 font-medium text-white"
                  : "bg-gray-100 text-gray-500")
              }
            >
              {ETAPA_LABEL[e]}
            </span>
          ))}
          {lead.etapa === EtapaLead.PERDIDO && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Perdido{lead.motivoPerda ? ` · ${MOTIVO_PERDA_LABEL[lead.motivoPerda]}` : ""}
            </span>
          )}
          {lead.etapa === EtapaLead.NO_SHOW && (
            <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">No-show</span>
          )}
        </div>
      </header>

      <ValorOportunidade lead={lead} />

      {/* C3 (doc 27): sugestões do copiloto — só-leitura até o vendedor decidir. */}
      <CopilotoSugestoes leadId={lead.id} sugestoes={sugestoesIA} copilotoAtivo={copilotoAtivo} />

      <BarraAcoes lead={lead} professores={professores} />

      {/* Acompanhamento contratual e de pagamento da matrícula aguardando. */}
      {lead.matricula?.status === "AGUARDANDO" && <FechamentoCard matricula={lead.matricula} />}

      <div className="grid gap-6 md:grid-cols-2">
        <Resumo lead={lead} />
        <ProximosPassos lead={lead} />
      </div>

      <Documentos leadId={lead.id} documentos={lead.documentos} />
      <HistoricoDono timeline={timeline} preferenciaFusoExibicao={preferenciaFusoExibicao} />
      <Timeline timeline={timeline} preferenciaFusoExibicao={preferenciaFusoExibicao} />
    </div>
  );
}

// Um estado de ação por seção da ficha: o erro aparece junto do botão que o disparou, não no topo.
// Nenhuma action daqui recebe chave de idempotência — server/comercial/acoes.ts: moverEtapa :364,
// atualizarResumo :288, atualizarDatas :328, registrarInteracao :403 (grava um evento novo a cada
// chamada), agendarExperimental :426, enviarProposta :485, marcarPerdido :508, anexarDocumentoLead
// :531 (cria um Documento a cada chamada), arquivarDocumentoLead :559; e server/matricula/acoes.ts:782
// registrarLinkPagamento. Resultado incerto manda conferir antes de repetir.
function useAcaoSecao() {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  /** Executa e, só com a confirmação do servidor, recarrega a ficha. Devolve se deu certo. */
  async function run<T>(disparar: () => Promise<Resultado<T>>): Promise<boolean> {
    const desfecho = await acao.executar(disparar);
    if (desfecho?.tipo !== "ok") return false;
    router.refresh();
    return true;
  }
  return { acao, run };
}

const CATEGORIA_LABEL: Record<CategoriaDocumento, string> = {
  PROPOSTA: "Proposta",
  CONTRATO: "Contrato",
  COMPROVANTE: "Comprovante",
  TESTE_NIVEL: "Teste de nível",
  OUTRO: "Outro",
};

function Documentos({
  leadId,
  documentos,
}: {
  leadId: string;
  documentos: LeadFicha["documentos"];
}) {
  const [categoria, setCategoria] = useState<CategoriaDocumento>(CategoriaDocumento.PROPOSTA);
  const { acao, run } = useAcaoSecao();
  // O erro aparece sob o anexo ou sob a linha do documento arquivado.
  const [alvo, setAlvo] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Documentos</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select aria-label="Categoria do documento" className={inputCls + " w-auto"} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}>
          {Object.values(CategoriaDocumento).map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
        <UploadArquivo
          label="Anexar documento"
          onUpload={(r) => { setAlvo("anexar"); run(() => anexarDocumentoLead(leadId, { categoria, nome: r.nome, url: r.url })); }}
        />
      </div>
      <FeedbackAcao erro={alvo === "anexar" ? acao.erro : null} className="mb-3" />
      {documentos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum documento anexado.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {documentos.map((d) => (
            <Fragment key={d.id}>
            <li className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <a href={d.url} target="_blank" className="text-brand-700 hover:underline">
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">{CATEGORIA_LABEL[d.categoria as CategoriaDocumento]}</span>{" "}
                {d.nome}
              </a>
              <button
                disabled={acao.ocupado}
                onClick={() => { setAlvo(d.id); run(() => arquivarDocumentoLead(d.id)); }}
                className="text-xs text-gray-400 hover:text-red-600"
              >
                arquivar
              </button>
            </li>
            {alvo === d.id && acao.erro && <li><FeedbackAcao erro={acao.erro} /></li>}
            </Fragment>
          ))}
        </ul>
      )}
    </section>
  );
}

function ValorOportunidade({ lead }: { lead: LeadFicha }) {
  // Fase 0: prioridade é FAIXA (não %), conforme decisão do doc 09.
  const faixa = lead.temperatura === "QUENTE" ? "Alta" : lead.temperatura === "MORNO" ? "Média" : "Baixa";
  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Valor da oportunidade</h2>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs text-gray-500">Matrícula prevista</div>
          <div className="font-medium text-gray-800">{lead.valorPrevisto != null ? lead.valorPrevisto.toLocaleString("pt-BR") : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Plano</div>
          <div className="font-medium text-gray-800">{lead.planoPrevisto || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Comissão prevista</div>
          <div className="font-medium text-gray-800">{lead.comissaoPrevista != null ? lead.comissaoPrevista.toLocaleString("pt-BR") : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Prioridade</div>
          <div className="font-medium text-gray-800">{faixa}</div>
        </div>
      </div>
    </section>
  );
}

function HistoricoDono({ timeline, preferenciaFusoExibicao }: { timeline: EventoTimeline[]; preferenciaFusoExibicao: string | null }) {
  const itens = timeline.filter((e) => e.tipo === "LeadAtribuido");
  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Histórico de dono</h2>
      {itens.length === 0 ? (
        <p className="text-sm text-gray-400">Sem transferências de dono.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {itens.map((ev) => {
            const p = (ev.payload ?? {}) as Record<string, unknown>;
            const motivo = typeof p.motivo === "string" ? p.motivo : null;
            return (
              <li key={ev.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-gray-700">Atribuição{motivo ? ` · ${motivo}` : ""}</div>
                <div className="text-xs text-gray-400">
                  {ev.autor?.nome ?? "sistema"} ·{" "}
                  {formatarInstanteExibicao(ev.criadoEm, preferenciaFusoExibicao, "UTC").texto} (horário exibido em {formatarInstanteExibicao(ev.criadoEm, preferenciaFusoExibicao, "UTC").fuso}; origem UTC)
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function BarraAcoes({
  lead,
  professores,
}: {
  lead: LeadFicha;
  professores: { id: string; nome: string }[];
}) {
  const [modal, setModal] = useState<"none" | "interacao" | "experimental" | "perdido">("none");
  const [nota, setNota] = useState("");
  const [canal, setCanal] = useState("");
  const [dataExp, setDataExp] = useState("");
  const [profExp, setProfExp] = useState(lead.professorExperimentalId ?? "");
  const [motivo, setMotivo] = useState<MotivoPerda>(MotivoPerda.NAO_RESPONDEU);
  const [obs, setObs] = useState("");
  const { acao, run } = useAcaoSecao();
  // Onde mostrar o resultado: na barra (etapa, proposta) ou no painel aberto (interação, experimental, perda).
  const [origem, setOrigem] = useState<"barra" | "interacao" | "experimental" | "perdido">("barra");
  const feedback = (secao: typeof origem) => <FeedbackAcao erro={origem === secao ? acao.erro : null} />;

  function alternar(painel: "interacao" | "experimental" | "perdido") {
    acao.limpar();
    setModal(modal === painel ? "none" : painel);
  }

  async function executar(secao: typeof origem, disparar: () => Promise<Resultado<unknown>>) {
    setOrigem(secao);
    return run(disparar);
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Mudar etapa do lead"
          value=""
          disabled={acao.ocupado}
          onChange={(e) => {
            const etapa = e.target.value as EtapaLead;
            if (etapa) executar("barra", () => moverEtapa(lead.id, etapa));
          }}
          className={inputCls + " w-auto"}
        >
          <option value="">Mudar etapa…</option>
          {ETAPAS_MANUAIS.map((e) => (
            <option key={e} value={e}>
              {ETAPA_LABEL[e]}
            </option>
          ))}
        </select>
        <button className={btnSec} onClick={() => alternar("interacao")}>
          Registrar interação
        </button>
        <button className={btnSec} onClick={() => alternar("experimental")}>
          Agendar experimental
        </button>
        <button className={btnSec} disabled={acao.ocupado} onClick={() => executar("barra", () => enviarProposta(lead.id))}>
          Enviar proposta
        </button>
        <button className={btnSec + " border-red-200 text-red-600 hover:bg-red-50"} onClick={() => alternar("perdido")}>
          Marcar perdido
        </button>
        {lead.matricula ? (
          <span className="rounded-md bg-green-50 px-3 py-1.5 text-sm text-green-700">
            Matrícula {lead.matricula.codigo ?? ""} ({lead.matricula.status})
          </span>
        ) : (
          <a href={`/matriculas/nova?lead=${lead.id}`} className={btnPri}>
            Converter em matrícula
          </a>
        )}
      </div>
      {origem === "barra" && acao.erro && <div className="mt-3">{feedback("barra")}</div>}

      {modal === "interacao" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
          <input aria-label="Canal da interação" className={inputCls} placeholder="Canal (WhatsApp, ligação…)" value={canal} onChange={(e) => setCanal(e.target.value)} />
          <textarea aria-label="Nota da interação" className={inputCls} placeholder="O que aconteceu na conversa?" value={nota} onChange={(e) => setNota(e.target.value)} />
          {feedback("interacao")}
          <div>
            <button
              className={btnPri}
              disabled={acao.ocupado}
              onClick={async () => {
                // Nota e canal só são limpos com a interação confirmada — na falha, o texto fica para conferir.
                if (!(await executar("interacao", () => registrarInteracao(lead.id, { canal, nota })))) return;
                setNota("");
                setCanal("");
                setModal("none");
              }}
            >
              Salvar interação
            </button>
          </div>
        </div>
      )}

      {modal === "experimental" && (
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
          <div>
            <label htmlFor="ficha-lead-agendar-data" className="mb-1 block text-xs text-gray-600">Data/hora da experimental</label>
            <input id="ficha-lead-agendar-data" type="datetime-local" className={inputCls} value={dataExp} onChange={(e) => setDataExp(e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-lead-agendar-professor" className="mb-1 block text-xs text-gray-600">Professor responsável</label>
            <select id="ficha-lead-agendar-professor" className={inputCls} value={profExp} onChange={(e) => setProfExp(e.target.value)}>
              <option value="">Definir depois</option>
              {professores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            className={btnPri}
            disabled={acao.ocupado}
            onClick={async () => {
              if (!dataExp) {
                setOrigem("experimental");
                acao.setErro("Informe a data/hora da experimental.");
                return;
              }
              if (await executar("experimental", () => agendarExperimental(lead.id, { dataISO: dataExp, professorId: profExp || undefined })))
                setModal("none");
            }}
          >
            Agendar
          </button>
          {origem === "experimental" && acao.erro && <div className="basis-full">{feedback("experimental")}</div>}
        </div>
      )}

      {modal === "perdido" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
          <select aria-label="Motivo da perda" className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoPerda)}>
            {Object.values(MotivoPerda).map((m) => (
              <option key={m} value={m}>
                {MOTIVO_PERDA_LABEL[m]}
              </option>
            ))}
          </select>
          <input aria-label="Observação da perda" className={inputCls} placeholder="Observação (obrigatória se 'Outro')" value={obs} onChange={(e) => setObs(e.target.value)} />
          {feedback("perdido")}
          <div>
            <button
              className={btnPri + " bg-danger hover:brightness-95"}
              disabled={acao.ocupado}
              onClick={async () => {
                if (await executar("perdido", () => marcarPerdido(lead.id, { motivoPerda: motivo, observacao: obs }))) setModal("none");
              }}
            >
              Confirmar perda
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Resumo({
  lead,
}: {
  lead: LeadFicha;
}) {
  const [editar, setEditar] = useState(false);
  const { acao, run } = useAcaoSecao();
  const [f, setF] = useState({
    interesse: lead.interesse ?? "",
    objetivo: lead.objetivo ?? "",
    urgencia: lead.urgencia ?? "",
    orcamento: lead.orcamento ?? "",
    objecao: lead.objecao ?? "",
    proximaAcao: lead.proximaAcao ?? "",
  });

  const campos: [keyof typeof f, string][] = [
    ["interesse", "Interesse"],
    ["objetivo", "Objetivo"],
    ["urgencia", "Urgência"],
    ["orcamento", "Orçamento"],
    ["objecao", "Objeção"],
    ["proximaAcao", "Próximo passo"],
  ];

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Resumo executivo</h2>
        <button className="text-xs text-brand-700 hover:text-brand-800" onClick={() => { acao.limpar(); setEditar(!editar); }}>
          {editar ? "Cancelar" : "Editar"}
        </button>
      </div>
      {editar ? (
        <div className="flex flex-col gap-2">
          {campos.map(([k, label]) => (
            <div key={k}>
              <label htmlFor={`ficha-lead-resumo-${k}`} className="mb-1 block text-xs text-gray-600">{label}</label>
              <input id={`ficha-lead-resumo-${k}`} className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <FeedbackAcao erro={acao.erro} />
          <div>
            <button
              className={btnPri}
              disabled={acao.ocupado}
              onClick={async () => {
                if (await run(() => atualizarResumo(lead.id, f))) setEditar(false);
              }}
            >
              Salvar resumo
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-2 text-sm">
          {campos.map(([k, label]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-28 shrink-0 text-gray-500">{label}</dt>
              <dd className="text-gray-800">{f[k] || "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function ProximosPassos({
  lead,
}: {
  lead: LeadFicha;
}) {
  const { acao, run } = useAcaoSecao();
  const [followUp, setFollow] = useState(soData(lead.proximoFollowUp));
  // datetime-local p/ preservar o horário da experimental já agendada (issue #16).
  const [exp, setExp] = useState(soDataHora(lead.dataExperimental));
  const [prop, setProp] = useState(soData(lead.dataProposta));

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Próximos passos / datas</h2>
      <p className="mb-3 text-xs text-gray-400">Alimentam a fila inteligente da Home.</p>
      <div className="flex flex-col gap-2">
        <div>
          <label htmlFor="ficha-lead-follow-up" className="mb-1 block text-xs text-gray-600">Próximo follow-up</label>
          <input id="ficha-lead-follow-up" type="date" className={inputCls} value={followUp} onChange={(e) => setFollow(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ficha-lead-data-experimental" className="mb-1 block text-xs text-gray-600">Data/hora da experimental</label>
          <input id="ficha-lead-data-experimental" type="datetime-local" className={inputCls} value={exp} onChange={(e) => setExp(e.target.value)} />
          <p className="mt-1 text-xs text-gray-400">Mantém o horário já agendado; ajuste a data sem perder a hora.</p>
        </div>
        <div>
          <label htmlFor="ficha-lead-data-proposta" className="mb-1 block text-xs text-gray-600">Data da proposta</label>
          <input id="ficha-lead-data-proposta" type="date" className={inputCls} value={prop} onChange={(e) => setProp(e.target.value)} />
        </div>
        <FeedbackAcao erro={acao.erro} />
        <div>
          <button
            className={btnPri}
            disabled={acao.ocupado}
            onClick={() =>
              run(() =>
                atualizarDatas(lead.id, {
                  proximoFollowUp: followUp,
                  dataExperimental: exp,
                  dataProposta: prop,
                }),
              )
            }
          >
            Salvar datas
          </button>
        </div>
      </div>
    </section>
  );
}

const EVENTO_LABEL: Record<string, string> = {
  LeadCriado: "Lead criado",
  LeadAtribuido: "Dono atribuído",
  LeadEditado: "Dados do lead editados",
  EtapaAlterada: "Etapa alterada",
  ResumoAtualizado: "Resumo atualizado",
  DatasAtualizadas: "Datas / próximos passos atualizados",
  ExperimentalAgendada: "Experimental agendada",
  ExperimentalRealizada: "Experimental realizada",
  NoShow: "No-show",
  PropostaEnviada: "Proposta enviada",
  LeadPerdido: "Lead perdido",
  InteracaoRegistrada: "Interação registrada",
  DocumentoAnexado: "Documento anexado",
  DocumentoArquivado: "Documento arquivado",
};

/** Texto auxiliar da timeline conforme o tipo de evento (resumo, datas, etapa…). */
const DATA_CIVIL_LITERAL = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_COM_OFFSET = /(?:Z|[+-]\d{2}:\d{2})$/i;

function dataCivilLiteral(valor: unknown) {
  if (typeof valor !== "string") return null;
  const partes = DATA_CIVIL_LITERAL.exec(valor);
  if (!partes) return null;
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const calendario = new Date(Date.UTC(ano, mes - 1, dia));
  return calendario.getUTCFullYear() === ano && calendario.getUTCMonth() === mes - 1 && calendario.getUTCDate() === dia ? valor : null;
}

function dataHistoricaSemOrigemCivil(valor: unknown, civil: unknown) {
  const literal = dataCivilLiteral(valor);
  if (literal) return literal;
  const confirmada = dataCivilLiteral(civil);
  if (confirmada) return confirmada;
  if (typeof valor !== "string" || !valor.trim()) return null;
  return `${valor} (registro histórico sem referência civil)`;
}

function experimentalHistorica(valor: unknown, preferenciaFusoExibicao: string | null) {
  const literal = dataCivilLiteral(valor);
  if (literal) return literal;
  if (typeof valor !== "string" || !valor.trim()) return null;
  if (!ISO_COM_OFFSET.test(valor) || !Number.isFinite(new Date(valor).getTime()))
    return `${valor} (registro histórico sem fuso de origem)`;
  const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
  return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
}

function detalheEvento(tipo: string, p: Record<string, unknown>, preferenciaFusoExibicao: string | null): string | null {
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  if (tipo === "ResumoAtualizado") {
    const partes = [
      txt(p.interesse) && `Interesse: ${txt(p.interesse)}`,
      txt(p.objetivo) && `Objetivo: ${txt(p.objetivo)}`,
      txt(p.urgencia) && `Urgência: ${txt(p.urgencia)}`,
      txt(p.orcamento) && `Orçamento: ${txt(p.orcamento)}`,
      txt(p.objecao) && `Objeção: ${txt(p.objecao)}`,
      txt(p.proximaAcao) && `Próximo passo: ${txt(p.proximaAcao)}`,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : "Resumo limpo";
  }
  if (tipo === "DatasAtualizadas") {
    const followUp = dataHistoricaSemOrigemCivil(p.proximoFollowUp, p.proximoFollowUpCivil);
    const experimental = experimentalHistorica(p.dataExperimental, preferenciaFusoExibicao);
    const proposta = dataHistoricaSemOrigemCivil(p.dataProposta, p.dataPropostaCivil);
    const partes = [
      followUp && `Follow-up: ${followUp}`,
      experimental && `Experimental: ${experimental}`,
      proposta && `Proposta: ${proposta}`,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : "Datas limpas";
  }
  if (tipo === "EtapaAlterada") {
    const de = p.de as EtapaLead | null;
    const para = p.para as EtapaLead | null;
    const rotulo = (e: EtapaLead | null) => (e ? (ETAPA_LABEL[e] ?? e) : "—");
    return para ? `${rotulo(de)} → ${rotulo(para)}` : null;
  }
  return txt(p.nota);
}

function Timeline({ timeline, preferenciaFusoExibicao }: { timeline: EventoTimeline[]; preferenciaFusoExibicao: string | null }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Linha do tempo</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-gray-400">Sem eventos ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {timeline.map((ev) => {
            const p = (ev.payload ?? {}) as Record<string, unknown>;
            const detalhe = detalheEvento(ev.tipo, p, preferenciaFusoExibicao);
            return (
              <li key={ev.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-sm text-gray-800">{EVENTO_LABEL[ev.tipo] ?? ev.tipo}</div>
                {detalhe && <div className="text-sm text-gray-600">{detalhe}</div>}
                <div className="text-xs text-gray-400">
                  {ev.autor?.nome ?? "sistema"} ·{" "}
                  {formatarInstanteExibicao(ev.criadoEm, preferenciaFusoExibicao, "UTC").texto} (horário exibido em {formatarInstanteExibicao(ev.criadoEm, preferenciaFusoExibicao, "UTC").fuso}; origem UTC)
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}


/** Acompanhamento contratual e do link de pagamento da matrícula aguardando. */
function FechamentoCard({
  matricula,
}: {
  matricula: NonNullable<LeadFicha["matricula"]>;
}) {
  const [linkUrl, setLinkUrl] = useState("");
  const { acao, run } = useAcaoSecao();
  const taxaPaga = matricula.taxa?.status === "PAGO";

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <h2 className="mb-2 text-sm font-medium text-blue-700">
        Fechamento — matrícula {matricula.codigo ?? ""} aguardando
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={
            "rounded-full px-2 py-0.5 font-medium " +
            (matricula.contratoOk
              ? "bg-green-100 text-green-700"
              : matricula.contratoEnviadoEm
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600")
          }
        >
          Contrato: {matricula.contratoOk ? "assinado" : matricula.contratoEnviadoEm ? "enviado, sem assinatura" : "não enviado"}
        </span>
        <span
          className={
            "rounded-full px-2 py-0.5 font-medium " +
            (taxaPaga ? "bg-green-100 text-green-700" : matricula.taxa?.linkEnviadoEm ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600")
          }
        >
          Taxa: {taxaPaga ? "paga" : matricula.taxa?.linkEnviadoEm ? "link enviado, sem pagamento" : "pendente"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!matricula.contratoOk && <><Link className={btnSec} href={`/matriculas/${matricula.id}/preparacao`}>Preparar matrícula</Link><Link className={btnSec} href={`/matriculas/${matricula.id}/contrato`}>Gerenciar documentos do contrato</Link></>}
        {!taxaPaga && matricula.taxa && (
          <span className="flex items-center gap-1">
            <input
              aria-label="Link ou código de pagamento enviado"
              className={inputCls + " w-64"}
              placeholder="Link/código de pagamento enviado"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
            />
            <button
              className={btnSec}
              disabled={!linkUrl.trim() || acao.ocupado}
              onClick={() => run(() => registrarLinkPagamento(matricula.taxa!.id, linkUrl))}
            >
              {matricula.taxa.linkEnviadoEm ? "Reenviar link" : "Registrar link"}
            </button>
          </span>
        )}
      </div>
      <FeedbackAcao erro={acao.erro} className="mt-2" />
      {matricula.taxa?.linkPagamento && !taxaPaga && (
        <p className="mt-2 break-all text-[11px] text-blue-700">
          Link atual: <a className="underline" href={matricula.taxa.linkPagamento} target="_blank" rel="noreferrer">{matricula.taxa.linkPagamento}</a>
        </p>
      )}
      <p className="mt-2 text-[11px] text-blue-700/70">Conclua as conferências necessárias no fluxo da matrícula antes de seguir com a ativação.</p>
    </section>
  );
}
