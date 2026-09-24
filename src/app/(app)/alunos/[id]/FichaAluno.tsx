"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusAluno, TipoMovimentacao, Genero, Escolaridade } from "@prisma/client";
import { STATUS_ALUNO_LABEL, GENERO_LABEL, ESCOLARIDADE_LABEL } from "@/lib/labels";
import { formatarValores, type ValorMoeda } from "@/lib/dinheiro";
import { PAISES_ISO, nomePaisISO } from "@/lib/paises-iso";
import { MOTIVOS_ENCERRAMENTO } from "@/server/alunos/schema";
import { pausarAluno, encerrarAluno, editarAluno } from "@/server/alunos/acoes";
import { Drawer } from "@/components/Drawer";
import { formatarInstanteExibicao } from "@/server/operacao/fuso-exibicao";
import type { ReferenciaVencimentoCivil } from "@/server/financeiro/vencimento-civil";

const TIPO_MOV_LABEL: Record<TipoMovimentacao, string> = {
  MATRICULA: "Matrícula",
  TROCA_TURMA: "Troca de turma",
  PAUSA: "Pausa",
  REATIVACAO: "Reativação",
  ENCERRAMENTO: "Encerramento",
};

const STATUS_CLS: Record<StatusAluno, string> = {
  ATIVO: "bg-green-100 text-green-700",
  PAUSADO: "bg-amber-100 text-amber-700",
  ENCERRADO: "bg-gray-200 text-gray-500",
};

export interface AlunoFicha {
  id: string;
  codigo: string | null;
  nome: string; // nome completo (exibição)
  primeiroNome: string;
  sobrenome: string | null;
  nomePreferido: string | null;
  status: StatusAluno;
  pais: string;
  paisId: string;
  nascimento: string | null;
  genero: Genero | null;
  tipoDocumentoId: string | null;
  documento: string | null;
  documentoValido: boolean;
  documentoPaisEmissor: string | null;
  nacionalidade: string | null;
  segundaNacionalidade: string | null;
  telefone: string | null;
  email: string | null;
  whatsapp: boolean;
  aceitaComunicacoes: boolean;
  paisResidencia: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  regiao: string | null;
  escolaridade: Escolaridade | null;
  idiomaNativo: string | null;
  fuso: string | null;
  observacoes: string | null;
  turmasAtuais: { id: string; matriculaCodigo: string | null; label: string; professor: string | null; diasHorario: string | null }[];
  // null na projeção pedagógica (professor não vê nada financeiro — doc 10).
  financeiro: { atrasado: boolean; emAberto: ValorMoeda[]; proximoVencimento: ReferenciaVencimentoCivil | null } | null;
  movimentacoes: {
    matriculaId: string | null;
    matriculaCodigo: string | null;
    id: string;
    tipo: TipoMovimentacao;
    motivo: string | null;
    observacao: string | null;
    criadoEm: string;
    usuario: string | null;
  }[];
}

interface PaisOpt {
  id: string;
  nome: string;
  tiposDocumento: { id: string; nome: string }[];
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
const btnPri = "rounded-md bg-brand-solid px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50";

export function FichaAluno({
  aluno,
  paises,
  podeMovimentar = false,
  podeMovimentarGlobal = false,
  podeEditarCadastro = false,
  podeConsultarAcademico = false,
  preferenciaFusoExibicao = null,
  turmaSugerida = null,
}: {
  aluno: AlunoFicha;
  paises: PaisOpt[];
  // Professor tem visão somente leitura: oculta editar/trocar/pausar/encerrar (doc 10).
  podeMovimentar?: boolean;
  podeMovimentarGlobal?: boolean;
  podeEditarCadastro?: boolean;
  podeConsultarAcademico?: boolean;
  preferenciaFusoExibicao?: string | null;
  /** C4 (auto-alocação híbrida): turma SUGERIDA na ativação — o consultor confirma aqui. */
  turmaSugerida?: { turmaId: string; label: string; diasHorario: string | null } | null;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<"none" | "pausar" | "encerrar" | "editar">("none");

  // estados dos modais
  const [motivoPausa, setMotivoPausa] = useState("");
  const [retorno, setRetorno] = useState("");
  const [motivoEnc, setMotivoEnc] = useState<(typeof MOTIVOS_ENCERRAMENTO)[number]>("Concluiu");
  const [obsEnc, setObsEnc] = useState("");
  const instanteAdministrativo = (valor: string) => {
    const exibicao = formatarInstanteExibicao(valor, preferenciaFusoExibicao, "UTC");
    return `${exibicao.texto} (horário exibido em ${exibicao.fuso}; origem UTC)`;
  };

  // edição de dados cadastrais (prefill com TODOS os valores atuais — edição lenient).
  const valoresEd = () => ({
    primeiroNome: aluno.primeiroNome,
    sobrenome: aluno.sobrenome ?? "",
    nomePreferido: aluno.nomePreferido ?? "",
    nascimento: aluno.nascimento ? aluno.nascimento.slice(0, 10) : "",
    genero: (aluno.genero ?? "") as Genero | "",
    paisId: aluno.paisId,
    tipoDocumentoId: aluno.tipoDocumentoId ?? "",
    documento: aluno.documento ?? "",
    documentoPaisEmissor: aluno.documentoPaisEmissor ?? "",
    nacionalidade: aluno.nacionalidade ?? "",
    segundaNacionalidade: aluno.segundaNacionalidade ?? "",
    email: aluno.email ?? "",
    telefone: aluno.telefone ?? "",
    whatsapp: aluno.whatsapp,
    aceitaComunicacoes: aluno.aceitaComunicacoes,
    paisResidencia: aluno.paisResidencia ?? "",
    cep: aluno.cep ?? "",
    rua: aluno.rua ?? "",
    numero: aluno.numero ?? "",
    complemento: aluno.complemento ?? "",
    bairro: aluno.bairro ?? "",
    cidade: aluno.cidade ?? "",
    regiao: aluno.regiao ?? "",
    escolaridade: (aluno.escolaridade ?? "") as Escolaridade | "",
    idiomaNativo: aluno.idiomaNativo ?? "",
    fuso: aluno.fuso ?? "",
    observacoes: aluno.observacoes ?? "",
    motivo: "",
  });
  const [ed, setEd] = useState(valoresEd);
  const set = <K extends keyof ReturnType<typeof valoresEd>>(k: K, v: ReturnType<typeof valoresEd>[K]) =>
    setEd((e) => ({ ...e, [k]: v }));

  const tiposDocEd = paises.find((p) => p.id === ed.paisId)?.tiposDocumento ?? [];
  const tipoDocNome =
    paises.find((p) => p.id === aluno.paisId)?.tiposDocumento.find((t) => t.id === aluno.tipoDocumentoId)?.nome ?? null;
  const enderecoResumo = [aluno.rua, aluno.numero, aluno.complemento, aluno.bairro, aluno.cidade, aluno.regiao]
    .filter(Boolean)
    .join(", ");

  function abrirEdicao() {
    setEd(valoresEd()); // recarrega valores atuais a cada abertura
    setErro(null);
    setModal("editar");
  }

  async function run(p: Promise<{ ok: boolean; erro?: string }>) {
    setErro(null);
    const r = await p;
    if (!r.ok) setErro(r.erro ?? "Erro.");
    else {
      setModal("none");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{aluno.nome}</h1>
          {aluno.nomePreferido && <span className="text-sm text-gray-500">({aluno.nomePreferido})</span>}
          <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_CLS[aluno.status]}>
            Cadastro: {STATUS_ALUNO_LABEL[aluno.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {aluno.codigo} · {aluno.pais}{podeEditarCadastro ? ` · ${aluno.telefone ?? "sem telefone"}` : ""}
        </p>
      </header>

      {/* Ações (apenas papéis que movimentam — professor tem visão somente leitura, doc 10) */}
      {podeMovimentar && (
        <div className="flex flex-wrap gap-2">
          {podeEditarCadastro && <button className={btnSec} onClick={abrirEdicao}>
            Editar dados
          </button>}
          {podeMovimentarGlobal && aluno.status === StatusAluno.ATIVO && (
            <>
              <button className={btnSec} onClick={() => setModal("pausar")}>Pausar</button>
              <button className={btnSec + " border-red-200 text-red-600 hover:bg-red-50"} onClick={() => setModal("encerrar")}>Encerrar</button>
            </>
          )}
          {podeMovimentarGlobal && aluno.status === StatusAluno.PAUSADO && (
            <>
              {podeEditarCadastro ? <Link className={btnPri} href={`/alunos/${aluno.id}/financeiro#retomada`}>Propor retomada</Link> : <span className="self-center text-sm text-gray-500">A secretaria deve encaminhar uma proposta de retomada para aprovação financeira.</span>}
              <button className={btnSec + " border-red-200 text-red-600 hover:bg-red-50"} onClick={() => setModal("encerrar")}>Encerrar</button>
            </>
          )}
        </div>
      )}

      {podeMovimentar && !podeMovimentarGlobal && <p className="text-sm text-gray-600">Pausa, retomada e encerramento devem identificar as matrículas envolvidas. A Secretaria acompanha essas solicitações no fluxo por matrícula.</p>}

      {podeConsultarAcademico && <div><Link className={btnSec} href={`/alunos/${aluno.id}/academico`}>{podeMovimentar ? "Turma, nível e solicitações acadêmicas" : "Consultar solicitações e emitir parecer"}</Link></div>}

      <Drawer
        open={modal === "editar"}
        onClose={() => setModal("none")}
        title="Editar dados do aluno"
        footer={
          <div className="flex justify-end gap-2">
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
            <button
              className={btnPri}
              disabled={!ed.motivo.trim() || !ed.primeiroNome.trim() || !ed.sobrenome.trim() || !ed.paisId}
              onClick={() =>
                run(
                  editarAluno(aluno.id, {
                    ...ed,
                    genero: ed.genero || undefined,
                    escolaridade: ed.escolaridade || undefined,
                  }),
                )
              }
            >
              Salvar alterações
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Identificação */}
          <div>
            <label htmlFor="ficha-primeiroNome" className="mb-1 block text-xs text-gray-600">Nome</label>
            <input id="ficha-primeiroNome" className={inputCls} value={ed.primeiroNome} onChange={(e) => set("primeiroNome", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-sobrenome" className="mb-1 block text-xs text-gray-600">Sobrenome(s)</label>
            <input id="ficha-sobrenome" className={inputCls} value={ed.sobrenome} onChange={(e) => set("sobrenome", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-nomePreferido" className="mb-1 block text-xs text-gray-600">Nome preferido</label>
            <input id="ficha-nomePreferido" className={inputCls} value={ed.nomePreferido} onChange={(e) => set("nomePreferido", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-nascimento" className="mb-1 block text-xs text-gray-600">Nascimento</label>
            <input id="ficha-nascimento" type="date" className={inputCls} value={ed.nascimento} onChange={(e) => set("nascimento", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-genero" className="mb-1 block text-xs text-gray-600">Gênero</label>
            <select id="ficha-genero" className={inputCls} value={ed.genero} onChange={(e) => set("genero", e.target.value as Genero | "")}>
              <option value="">—</option>
              {Object.values(Genero).map((g) => (
                <option key={g} value={g}>{GENERO_LABEL[g]}</option>
              ))}
            </select>
          </div>

          {/* Documentação */}
          <div>
            <label htmlFor="ficha-paisId" className="mb-1 block text-xs text-gray-600">País</label>
            <select id="ficha-paisId"
              className={inputCls}
              value={ed.paisId}
              onChange={(e) => {
                const np = paises.find((p) => p.id === e.target.value);
                setEd((s) => ({
                  ...s,
                  paisId: e.target.value,
                  tipoDocumentoId: np?.tiposDocumento.some((t) => t.id === s.tipoDocumentoId) ? s.tipoDocumentoId : "",
                }));
              }}
            >
              {paises.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ficha-tipoDocumentoId" className="mb-1 block text-xs text-gray-600">Tipo de documento</label>
            <select id="ficha-tipoDocumentoId" className={inputCls} value={ed.tipoDocumentoId} onChange={(e) => set("tipoDocumentoId", e.target.value)}>
              <option value="">—</option>
              {tiposDocEd.map((t) => (
                <option key={t.id} value={t.id}>{t.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ficha-documento" className="mb-1 block text-xs text-gray-600">Número do documento</label>
            <input id="ficha-documento" aria-describedby="ficha-documento-ajuda" className={inputCls} value={ed.documento} onChange={(e) => set("documento", e.target.value)} />
            <p id="ficha-documento-ajuda" className="mt-1 text-xs text-gray-500">Documento inválido não impede salvar — fica marcado como “não validado”.</p>
          </div>
          <div>
            <label htmlFor="ficha-documentoPaisEmissor" className="mb-1 block text-xs text-gray-600">País emissor</label>
            <SelectISO id="ficha-documentoPaisEmissor" value={ed.documentoPaisEmissor} onChange={(v) => set("documentoPaisEmissor", v)} comVazio />
          </div>
          <div>
            <label htmlFor="ficha-nacionalidade" className="mb-1 block text-xs text-gray-600">Nacionalidade</label>
            <SelectISO id="ficha-nacionalidade" value={ed.nacionalidade} onChange={(v) => set("nacionalidade", v)} comVazio />
          </div>
          <div>
            <label htmlFor="ficha-segundaNacionalidade" className="mb-1 block text-xs text-gray-600">Segunda nacionalidade</label>
            <SelectISO id="ficha-segundaNacionalidade" value={ed.segundaNacionalidade} onChange={(v) => set("segundaNacionalidade", v)} comVazio />
          </div>

          {/* Contato */}
          <div>
            <label htmlFor="ficha-email" className="mb-1 block text-xs text-gray-600">E-mail</label>
            <input id="ficha-email" type="email" className={inputCls} value={ed.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-telefone" className="mb-1 block text-xs text-gray-600">Telefone</label>
            <input id="ficha-telefone" className={inputCls} value={ed.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="+506..." />
          </div>
          <div className="flex items-center gap-4 pt-5 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={ed.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} />
              É WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={ed.aceitaComunicacoes} onChange={(e) => set("aceitaComunicacoes", e.target.checked)} />
              Recebe comunicações
            </label>
          </div>

          {/* Residência */}
          <div>
            <label htmlFor="ficha-paisResidencia" className="mb-1 block text-xs text-gray-600">País de residência</label>
            <SelectISO id="ficha-paisResidencia" value={ed.paisResidencia} onChange={(v) => set("paisResidencia", v)} comVazio />
          </div>
          <div>
            <label htmlFor="ficha-cep" className="mb-1 block text-xs text-gray-600">CEP / Código postal</label>
            <input id="ficha-cep" className={inputCls} value={ed.cep} onChange={(e) => set("cep", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-regiao" className="mb-1 block text-xs text-gray-600">Região / Estado / Província</label>
            <input id="ficha-regiao" className={inputCls} value={ed.regiao} onChange={(e) => set("regiao", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-cidade" className="mb-1 block text-xs text-gray-600">Cidade</label>
            <input id="ficha-cidade" className={inputCls} value={ed.cidade} onChange={(e) => set("cidade", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-bairro" className="mb-1 block text-xs text-gray-600">Bairro / Distrito</label>
            <input id="ficha-bairro" className={inputCls} value={ed.bairro} onChange={(e) => set("bairro", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-rua" className="mb-1 block text-xs text-gray-600">Rua</label>
            <input id="ficha-rua" className={inputCls} value={ed.rua} onChange={(e) => set("rua", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-numero" className="mb-1 block text-xs text-gray-600">Número</label>
            <input id="ficha-numero" className={inputCls} value={ed.numero} onChange={(e) => set("numero", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-complemento" className="mb-1 block text-xs text-gray-600">Complemento</label>
            <input id="ficha-complemento" className={inputCls} value={ed.complemento} onChange={(e) => set("complemento", e.target.value)} />
          </div>

          {/* Acadêmico / operacional */}
          <div>
            <label htmlFor="ficha-escolaridade" className="mb-1 block text-xs text-gray-600">Escolaridade</label>
            <select id="ficha-escolaridade" className={inputCls} value={ed.escolaridade} onChange={(e) => set("escolaridade", e.target.value as Escolaridade | "")}>
              <option value="">—</option>
              {Object.values(Escolaridade).map((e) => (
                <option key={e} value={e}>{ESCOLARIDADE_LABEL[e]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ficha-idiomaNativo" className="mb-1 block text-xs text-gray-600">Idioma nativo</label>
            <input id="ficha-idiomaNativo" className={inputCls} value={ed.idiomaNativo} onChange={(e) => set("idiomaNativo", e.target.value)} />
          </div>
          <div>
            <label htmlFor="ficha-fuso" className="mb-1 block text-xs text-gray-600">Fuso horário</label>
            <input id="ficha-fuso" className={inputCls} value={ed.fuso} onChange={(e) => set("fuso", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ficha-observacoes" className="mb-1 block text-xs text-gray-600">Observações</label>
            <textarea id="ficha-observacoes" className={inputCls} rows={2} value={ed.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>

          {/* Auditoria */}
          <div className="sm:col-span-2">
            <label htmlFor="ficha-motivo" className="mb-1 block text-xs text-gray-600">Motivo da edição <span className="text-red-600">*</span></label>
            <textarea id="ficha-motivo" aria-describedby="ficha-motivo-ajuda" aria-required="true"
              className={inputCls}
              rows={2}
              placeholder="Ex.: correção de documento informado pelo aluno"
              value={ed.motivo}
              onChange={(e) => set("motivo", e.target.value)}
            />
            <p id="ficha-motivo-ajuda" className="mt-1 text-xs text-gray-500">Fica registrado na auditoria, junto com quem editou.</p>
          </div>
        </div>
      </Drawer>

      {modal === "pausar" && (
        <div className="rounded-lg border border-gray-200 bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Pausar aluno</h3>
          <input className={inputCls + " mb-2"} aria-label="Motivo da pausa" placeholder="Motivo" value={motivoPausa} onChange={(e) => setMotivoPausa(e.target.value)} />
          <label htmlFor="pausa-retorno" className="mb-1 block text-xs text-gray-600">Retorno previsto (opcional)</label>
          <input id="pausa-retorno" type="date" className={inputCls + " mb-3"} value={retorno} onChange={(e) => setRetorno(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnPri} onClick={() => run(pausarAluno(aluno.id, { motivo: motivoPausa, dataRetornoPrevista: retorno }))}>Confirmar pausa</button>
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
          </div>
        </div>
      )}

      {modal === "encerrar" && (
        <div className="rounded-lg border border-gray-200 bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Encerrar aluno</h3>
          <select className={inputCls + " mb-2"} aria-label="Motivo do encerramento" value={motivoEnc} onChange={(e) => setMotivoEnc(e.target.value as typeof motivoEnc)}>
            {MOTIVOS_ENCERRAMENTO.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input className={inputCls + " mb-3"} aria-label="Observação do encerramento" placeholder="Observação (obrigatória se 'Outro')" value={obsEnc} onChange={(e) => setObsEnc(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnPri + " bg-danger hover:brightness-95"} onClick={() => run(encerrarAluno(aluno.id, { motivo: motivoEnc, observacao: obsEnc }))}>Confirmar encerramento</button>
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Turmas atuais</h2>
          {aluno.turmasAtuais.length > 0 ? aluno.turmasAtuais.map((turma) => (
            <div key={turma.id} className="mb-3 text-sm text-gray-700">
              <div className="font-medium">{turma.label}</div>
              <div className="text-gray-500">{turma.matriculaCodigo ? `Matrícula ${turma.matriculaCodigo}` : "Matrícula sem código ou vínculo a conferir"}</div>
              <div className="text-gray-500">{turma.diasHorario ?? "Horário a definir"}</div>
              <div className="text-gray-500">Professor: {turma.professor ?? "—"}</div>
            </div>
          )) : (
            <>
              <p className="text-sm text-gray-400">Sem turma (lista de espera).</p>
              {turmaSugerida && podeMovimentar && (
                // C4 (doc 08 §auto-alocação híbrida): o sistema SUGERIU na ativação;
                // alocar de verdade é decisão do consultor — 1 clique aqui.
                <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-2">
                  <div className="text-xs font-medium text-blue-700">Turma sugerida na ativação</div>
                  <div className="mt-0.5 text-gray-700">{turmaSugerida.label}</div>
                  {turmaSugerida.diasHorario && <div className="text-xs text-gray-500">{turmaSugerida.diasHorario}</div>}
                  <Link className={btnPri + " mt-2 inline-block"} href={`/alunos/${aluno.id}/academico`}>
                    Preparar alocação por matrícula
                  </Link>
                </div>
              )}
            </>
          )}

          {podeEditarCadastro && <>
          <h2 className="mb-2 mt-5 font-medium">Dados pessoais</h2>
          <dl className="grid grid-cols-1 gap-1 text-sm text-gray-700">
            <Linha rotulo="Documento">
              <span className="flex items-center gap-2">
                {[tipoDocNome, aluno.documento].filter(Boolean).join(": ") || "—"}
                {aluno.documentoPaisEmissor && <span className="text-gray-400">({nomePaisISO(aluno.documentoPaisEmissor)})</span>}
                {aluno.documento && !aluno.documentoValido && (
                  <span
                    className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                    title="O documento não passou na validação do país. Salvamento permitido; confira o número."
                  >
                    não validado
                  </span>
                )}
              </span>
            </Linha>
            <Linha rotulo="Nascimento">{aluno.nascimento ? new Date(aluno.nascimento).toLocaleDateString("pt-BR") : "—"}</Linha>
            <Linha rotulo="Gênero">{aluno.genero ? GENERO_LABEL[aluno.genero] : "—"}</Linha>
            <Linha rotulo="Nacionalidade">
              {[aluno.nacionalidade, aluno.segundaNacionalidade].filter(Boolean).map(nomePaisISO).join(" · ") || "—"}
            </Linha>
            <Linha rotulo="E-mail">{aluno.email ?? "—"}</Linha>
            <Linha rotulo="Telefone">
              {aluno.telefone ?? "—"} {aluno.whatsapp && aluno.telefone && <span className="text-green-600">· WhatsApp</span>}
            </Linha>
            <Linha rotulo="Residência">
              {[enderecoResumo, aluno.cep, nomePaisISO(aluno.paisResidencia)].filter((v) => v && v !== "—").join(" · ") || "—"}
            </Linha>
            <Linha rotulo="Escolaridade">{aluno.escolaridade ? ESCOLARIDADE_LABEL[aluno.escolaridade] : "—"}</Linha>
            <Linha rotulo="Idioma nativo">{aluno.idiomaNativo ?? "—"}</Linha>
            {aluno.observacoes && <Linha rotulo="Observações">{aluno.observacoes}</Linha>}
          </dl>
          </>}
        </section>

        {/* Financeiro: oculto na projeção pedagógica (professor — doc 10). */}
        {aluno.financeiro && (
          <section className="rounded-lg border border-gray-200 bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Financeiro</h2>
              <span className={aluno.financeiro.atrasado ? "text-sm text-red-600" : "text-sm text-green-600"}>
                {aluno.financeiro.atrasado ? "Em atraso" : "Em dia"}
              </span>
            </div>
            <div className="text-sm text-gray-700">
              Em aberto: <strong>{formatarValores(aluno.financeiro.emAberto)}</strong>
              {aluno.financeiro.proximoVencimento && (
                <span className="ml-2 text-gray-500">
                  · próximo venc. {aluno.financeiro.proximoVencimento.estado === "CONFIRMADO"
                    ? aluno.financeiro.proximoVencimento.dataCivil
                    : "a conferir"}
                </span>
              )}
            </div>
            <Link href={`/alunos/${aluno.id}/financeiro`} className="mt-2 inline-block text-xs text-brand-700 hover:underline">
              Ver ficha financeira →
            </Link>
          </section>
        )}
      </div>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Histórico de movimentações</h2>
        {aluno.movimentacoes.length === 0 ? (
          <p className="text-sm text-gray-400">Sem movimentações.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {aluno.movimentacoes.map((m) => (
              <li key={m.id} className="border-l-2 border-gray-200 pl-3">
                <div className="text-sm font-medium text-gray-800">{TIPO_MOV_LABEL[m.tipo]}</div>
                <div className="text-xs text-gray-500">{m.matriculaId ? `Matrícula: ${m.matriculaCodigo ?? "sem código"}` : "Registro global ou legado sem matrícula identificada"}</div>
                {m.motivo && <div className="text-sm text-gray-600">{m.motivo}</div>}
                {m.observacao && <div className="text-xs text-gray-500">{m.observacao}</div>}
                <div className="text-xs text-gray-400">
                  {m.usuario ?? "sistema"} ·{" "}
                  {instanteAdministrativo(m.criadoEm)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-32 shrink-0 text-gray-500">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Select de país ISO 3166. */
function SelectISO({ id, value, onChange, comVazio }: { id?: string; value: string; onChange: (v: string) => void; comVazio?: boolean }) {
  return (
    <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {comVazio && <option value="">—</option>}
      {PAISES_ISO.map((p) => (
        <option key={p.codigo} value={p.codigo}>{p.nome}</option>
      ))}
    </select>
  );
}
