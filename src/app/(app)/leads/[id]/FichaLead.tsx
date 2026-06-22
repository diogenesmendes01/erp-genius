"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EtapaLead, Segmento, Temperatura, MotivoPerda, CategoriaDocumento } from "@prisma/client";
import { UploadArquivo } from "@/components/UploadArquivo";
import { anexarDocumentoLead, arquivarDocumentoLead } from "@/server/comercial/acoes";
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
  matricula: { id: string; codigo: string | null; status: string } | null;
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
  "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50";

function diasNoFunil(criadoEm: string): number {
  const ms = Date.now() - new Date(criadoEm).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function soData(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

export function FichaLead({
  lead,
  timeline,
  professores = [],
}: {
  lead: LeadFicha;
  timeline: EventoTimeline[];
  professores?: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const refresh = () => router.refresh();

  async function run(p: Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    const r = await p;
    if (!r.ok) setErro(r.erro ?? "Erro.");
    else refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

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
        {(lead.origemCampanha || lead.origemAnuncio) && (
          <p className="mt-1 text-xs text-gray-400">
            Origem: {lead.origemCampanha ?? "—"} {lead.origemAnuncio ? `· ${lead.origemAnuncio}` : ""}
          </p>
        )}

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

      <BarraAcoes lead={lead} run={run} professores={professores} />

      <div className="grid gap-6 md:grid-cols-2">
        <Resumo lead={lead} run={run} />
        <ProximosPassos lead={lead} run={run} />
      </div>

      <Documentos leadId={lead.id} documentos={lead.documentos} run={run} />
      <HistoricoDono timeline={timeline} />
      <Timeline timeline={timeline} />
    </div>
  );
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
  run,
}: {
  leadId: string;
  documentos: LeadFicha["documentos"];
  run: (p: Promise<{ ok: boolean; erro?: string }>) => void;
}) {
  const [categoria, setCategoria] = useState<CategoriaDocumento>(CategoriaDocumento.PROPOSTA);

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Documentos</h2>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className={inputCls + " w-auto"} value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}>
          {Object.values(CategoriaDocumento).map((c) => (
            <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
          ))}
        </select>
        <UploadArquivo
          label="Anexar documento"
          onUpload={(r) => run(anexarDocumentoLead(leadId, { categoria, nome: r.nome, url: r.url }))}
        />
      </div>
      {documentos.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum documento anexado.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <a href={d.url} target="_blank" className="text-brand-700 hover:underline">
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">{CATEGORIA_LABEL[d.categoria as CategoriaDocumento]}</span>{" "}
                {d.nome}
              </a>
              <button onClick={() => run(arquivarDocumentoLead(d.id))} className="text-xs text-gray-400 hover:text-red-600">
                arquivar
              </button>
            </li>
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

function HistoricoDono({ timeline }: { timeline: EventoTimeline[] }) {
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
                  {new Date(ev.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
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
  run,
  professores,
}: {
  lead: LeadFicha;
  run: (p: Promise<{ ok: boolean; erro?: string }>) => void;
  professores: { id: string; nome: string }[];
}) {
  const [modal, setModal] = useState<"none" | "interacao" | "experimental" | "perdido">("none");
  const [nota, setNota] = useState("");
  const [canal, setCanal] = useState("");
  const [dataExp, setDataExp] = useState("");
  const [profExp, setProfExp] = useState(lead.professorExperimentalId ?? "");
  const [motivo, setMotivo] = useState<MotivoPerda>(MotivoPerda.NAO_RESPONDEU);
  const [obs, setObs] = useState("");

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          onChange={(e) => e.target.value && run(moverEtapa(lead.id, e.target.value as EtapaLead))}
          className={inputCls + " w-auto"}
        >
          <option value="">Mudar etapa…</option>
          {ETAPAS_MANUAIS.map((e) => (
            <option key={e} value={e}>
              {ETAPA_LABEL[e]}
            </option>
          ))}
        </select>
        <button className={btnSec} onClick={() => setModal(modal === "interacao" ? "none" : "interacao")}>
          Registrar interação
        </button>
        <button className={btnSec} onClick={() => setModal(modal === "experimental" ? "none" : "experimental")}>
          Agendar experimental
        </button>
        <button className={btnSec} onClick={() => run(enviarProposta(lead.id))}>
          Enviar proposta
        </button>
        <button className={btnSec + " border-red-200 text-red-600 hover:bg-red-50"} onClick={() => setModal(modal === "perdido" ? "none" : "perdido")}>
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

      {modal === "interacao" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
          <input className={inputCls} placeholder="Canal (WhatsApp, ligação…)" value={canal} onChange={(e) => setCanal(e.target.value)} />
          <textarea className={inputCls} placeholder="O que aconteceu na conversa?" value={nota} onChange={(e) => setNota(e.target.value)} />
          <div>
            <button
              className={btnPri}
              onClick={() => {
                run(registrarInteracao(lead.id, { canal, nota }));
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
            <label className="mb-1 block text-xs text-gray-600">Data/hora da experimental</label>
            <input type="datetime-local" className={inputCls} value={dataExp} onChange={(e) => setDataExp(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Professor responsável</label>
            <select className={inputCls} value={profExp} onChange={(e) => setProfExp(e.target.value)}>
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
            onClick={() => {
              if (dataExp) run(agendarExperimental(lead.id, { dataISO: dataExp, professorId: profExp || undefined }));
              setModal("none");
            }}
          >
            Agendar
          </button>
        </div>
      )}

      {modal === "perdido" && (
        <div className="mt-4 flex flex-col gap-2 border-t border-gray-100 pt-4">
          <select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoPerda)}>
            {Object.values(MotivoPerda).map((m) => (
              <option key={m} value={m}>
                {MOTIVO_PERDA_LABEL[m]}
              </option>
            ))}
          </select>
          <input className={inputCls} placeholder="Observação (obrigatória se 'Outro')" value={obs} onChange={(e) => setObs(e.target.value)} />
          <div>
            <button
              className={btnPri + " bg-danger hover:opacity-90"}
              onClick={() => {
                run(marcarPerdido(lead.id, { motivoPerda: motivo, observacao: obs }));
                setModal("none");
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
  run,
}: {
  lead: LeadFicha;
  run: (p: Promise<{ ok: boolean; erro?: string }>) => void;
}) {
  const [editar, setEditar] = useState(false);
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
        <button className="text-xs text-brand-700 hover:text-brand-800" onClick={() => setEditar(!editar)}>
          {editar ? "Cancelar" : "Editar"}
        </button>
      </div>
      {editar ? (
        <div className="flex flex-col gap-2">
          {campos.map(([k, label]) => (
            <div key={k}>
              <label className="mb-1 block text-xs text-gray-600">{label}</label>
              <input className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <div>
            <button
              className={btnPri}
              onClick={() => {
                run(atualizarResumo(lead.id, f));
                setEditar(false);
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
  run,
}: {
  lead: LeadFicha;
  run: (p: Promise<{ ok: boolean; erro?: string }>) => void;
}) {
  const [followUp, setFollow] = useState(soData(lead.proximoFollowUp));
  const [exp, setExp] = useState(soData(lead.dataExperimental));
  const [prop, setProp] = useState(soData(lead.dataProposta));

  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Próximos passos / datas</h2>
      <p className="mb-3 text-xs text-gray-400">Alimentam a fila inteligente da Home.</p>
      <div className="flex flex-col gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-600">Próximo follow-up</label>
          <input type="date" className={inputCls} value={followUp} onChange={(e) => setFollow(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Data da experimental</label>
          <input type="date" className={inputCls} value={exp} onChange={(e) => setExp(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">Data da proposta</label>
          <input type="date" className={inputCls} value={prop} onChange={(e) => setProp(e.target.value)} />
        </div>
        <div>
          <button
            className={btnPri}
            onClick={() =>
              run(
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

function Timeline({ timeline }: { timeline: EventoTimeline[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-surface p-4">
      <h2 className="mb-3 font-medium">Linha do tempo</h2>
      {timeline.length === 0 ? (
        <p className="text-sm text-gray-400">Sem eventos ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {timeline.map((ev) => {
            const p = (ev.payload ?? {}) as Record<string, unknown>;
            const nota = typeof p.nota === "string" ? p.nota : null;
            return (
              <li key={ev.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-sm text-gray-800">{ev.tipo}</div>
                {nota && <div className="text-sm text-gray-600">{nota}</div>}
                <div className="text-xs text-gray-400">
                  {ev.autor?.nome ?? "sistema"} ·{" "}
                  {new Date(ev.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
