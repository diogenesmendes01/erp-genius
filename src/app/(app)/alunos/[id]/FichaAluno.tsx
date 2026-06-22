"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusAluno, TipoMovimentacao, Genero } from "@prisma/client";
import { STATUS_ALUNO_LABEL } from "@/lib/labels";

const GENERO_LABEL: Record<Genero, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  OUTRO: "Outro",
  NAO_INFORMADO: "Não informado",
};
import { MOTIVOS_ENCERRAMENTO } from "@/server/alunos/schema";
import { pausarAluno, reativarAluno, encerrarAluno, trocarTurma, editarAluno } from "@/server/alunos/acoes";
import { Drawer } from "@/components/Drawer";

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
  nome: string;
  status: StatusAluno;
  pais: string;
  paisId: string;
  nascimento: string | null;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  genero: Genero | null;
  turmaAtual: { id: string; label: string; professor: string | null; diasHorario: string | null } | null;
  // null na projeção pedagógica (professor não vê nada financeiro — doc 10).
  financeiro: { atrasado: boolean; emAberto: number; proximoVencimento: string | null } | null;
  movimentacoes: {
    id: string;
    tipo: TipoMovimentacao;
    motivo: string | null;
    observacao: string | null;
    criadoEm: string;
    usuario: string | null;
  }[];
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
const btnPri = "rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60";
const btnSec = "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50";

export function FichaAluno({
  aluno,
  turmas,
  paises,
  podeMovimentar = true,
}: {
  aluno: AlunoFicha;
  turmas: { id: string; label: string }[];
  paises: { id: string; nome: string }[];
  // Professor tem visão somente leitura: oculta editar/trocar/pausar/encerrar (doc 10).
  podeMovimentar?: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<"none" | "pausar" | "encerrar" | "trocar" | "editar">("none");

  // estados dos modais
  const [motivoPausa, setMotivoPausa] = useState("");
  const [retorno, setRetorno] = useState("");
  const [motivoEnc, setMotivoEnc] = useState<(typeof MOTIVOS_ENCERRAMENTO)[number]>("Concluiu");
  const [obsEnc, setObsEnc] = useState("");
  const [turmaDest, setTurmaDest] = useState("");
  const [justif, setJustif] = useState("");
  // edição de dados cadastrais (prefill com os valores atuais)
  const valoresEd = () => ({
    nome: aluno.nome,
    paisId: aluno.paisId,
    documento: aluno.documento ?? "",
    telefone: aluno.telefone ?? "",
    email: aluno.email ?? "",
    genero: (aluno.genero ?? "") as Genero | "",
    nascimento: aluno.nascimento ? aluno.nascimento.slice(0, 10) : "",
    motivo: "",
  });
  const [ed, setEd] = useState(valoresEd);

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
      {erro && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{aluno.nome}</h1>
          <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + STATUS_CLS[aluno.status]}>
            {STATUS_ALUNO_LABEL[aluno.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {aluno.codigo} · {aluno.pais} · {aluno.telefone ?? "sem telefone"}
        </p>
      </header>

      {/* Ações (apenas papéis que movimentam — professor tem visão somente leitura, doc 10) */}
      {podeMovimentar && (
        <div className="flex flex-wrap gap-2">
          <button className={btnSec} onClick={abrirEdicao}>
            Editar dados
          </button>
          {aluno.status === StatusAluno.ATIVO && (
            <>
              <button className={btnSec} onClick={() => setModal("trocar")}>Trocar turma</button>
              <button className={btnSec} onClick={() => setModal("pausar")}>Pausar</button>
              <button className={btnSec + " border-red-200 text-red-600 hover:bg-red-50"} onClick={() => setModal("encerrar")}>Encerrar</button>
            </>
          )}
          {aluno.status === StatusAluno.PAUSADO && (
            <>
              <button className={btnPri} onClick={() => run(reativarAluno(aluno.id))}>Reativar</button>
              <button className={btnSec + " border-red-200 text-red-600 hover:bg-red-50"} onClick={() => setModal("encerrar")}>Encerrar</button>
            </>
          )}
        </div>
      )}

      <Drawer
        open={modal === "editar"}
        onClose={() => setModal("none")}
        title="Editar dados do aluno"
        footer={
          <div className="flex justify-end gap-2">
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
            <button
              className={btnPri}
              disabled={!ed.motivo.trim() || !ed.nome.trim() || !ed.paisId}
              onClick={() => run(editarAluno(aluno.id, { ...ed, genero: ed.genero || undefined }))}
            >
              Salvar alterações
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-gray-600">Nome</label>
            <input className={inputCls} value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">País</label>
            <select className={inputCls} value={ed.paisId} onChange={(e) => setEd({ ...ed, paisId: e.target.value })}>
              {paises.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Documento</label>
            <input className={inputCls} value={ed.documento} onChange={(e) => setEd({ ...ed, documento: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Telefone</label>
            <input className={inputCls} value={ed.telefone} onChange={(e) => setEd({ ...ed, telefone: e.target.value })} placeholder="+506..." />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">E-mail</label>
            <input type="email" className={inputCls} value={ed.email} onChange={(e) => setEd({ ...ed, email: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Gênero</label>
            <select className={inputCls} value={ed.genero} onChange={(e) => setEd({ ...ed, genero: e.target.value as Genero | "" })}>
              <option value="">—</option>
              {Object.values(Genero).map((g) => (
                <option key={g} value={g}>{GENERO_LABEL[g]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Nascimento</label>
            <input type="date" className={inputCls} value={ed.nascimento} onChange={(e) => setEd({ ...ed, nascimento: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-gray-600">Motivo da edição <span className="text-red-600">*</span></label>
            <textarea
              className={inputCls}
              rows={2}
              placeholder="Ex.: correção de documento informado pelo aluno"
              value={ed.motivo}
              onChange={(e) => setEd({ ...ed, motivo: e.target.value })}
            />
            <p className="mt-1 text-xs text-gray-500">Fica registrado na auditoria, junto com quem editou.</p>
          </div>
        </div>
      </Drawer>

      {modal === "pausar" && (
        <div className="rounded-lg border border-gray-200 bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Pausar aluno</h3>
          <input className={inputCls + " mb-2"} placeholder="Motivo" value={motivoPausa} onChange={(e) => setMotivoPausa(e.target.value)} />
          <label className="mb-1 block text-xs text-gray-600">Retorno previsto (opcional)</label>
          <input type="date" className={inputCls + " mb-3"} value={retorno} onChange={(e) => setRetorno(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnPri} onClick={() => run(pausarAluno(aluno.id, { motivo: motivoPausa, dataRetornoPrevista: retorno }))}>Confirmar pausa</button>
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
          </div>
        </div>
      )}

      {modal === "encerrar" && (
        <div className="rounded-lg border border-gray-200 bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Encerrar aluno</h3>
          <select className={inputCls + " mb-2"} value={motivoEnc} onChange={(e) => setMotivoEnc(e.target.value as typeof motivoEnc)}>
            {MOTIVOS_ENCERRAMENTO.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input className={inputCls + " mb-3"} placeholder="Observação (obrigatória se 'Outro')" value={obsEnc} onChange={(e) => setObsEnc(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnPri + " bg-danger hover:opacity-90"} onClick={() => run(encerrarAluno(aluno.id, { motivo: motivoEnc, observacao: obsEnc }))}>Confirmar encerramento</button>
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
          </div>
        </div>
      )}

      {modal === "trocar" && (
        <div className="rounded-lg border border-gray-200 bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium">Trocar turma</h3>
          <select className={inputCls + " mb-2"} value={turmaDest} onChange={(e) => setTurmaDest(e.target.value)}>
            <option value="">Selecione a turma…</option>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <input className={inputCls + " mb-3"} placeholder="Justificativa (exigida entre níveis)" value={justif} onChange={(e) => setJustif(e.target.value)} />
          <div className="flex gap-2">
            <button className={btnPri} disabled={!turmaDest} onClick={() => run(trocarTurma(aluno.id, { turmaDestinoId: turmaDest, justificativa: justif }))}>Confirmar troca</button>
            <button className={btnSec} onClick={() => setModal("none")}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-surface p-4">
          <h2 className="mb-3 font-medium">Turma atual</h2>
          {aluno.turmaAtual ? (
            <div className="text-sm text-gray-700">
              <div className="font-medium">{aluno.turmaAtual.label}</div>
              <div className="text-gray-500">{aluno.turmaAtual.diasHorario ?? "Horário a definir"}</div>
              <div className="text-gray-500">Professor: {aluno.turmaAtual.professor ?? "—"}</div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Sem turma (lista de espera).</p>
          )}

          <h2 className="mb-2 mt-5 font-medium">Dados pessoais</h2>
          <dl className="text-sm text-gray-700">
            <div className="flex gap-2"><dt className="w-32 text-gray-500">Documento</dt><dd>{aluno.documento ?? "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-32 text-gray-500">Nascimento</dt><dd>{aluno.nascimento ? new Date(aluno.nascimento).toLocaleDateString("pt-BR") : "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-32 text-gray-500">E-mail</dt><dd>{aluno.email ?? "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-32 text-gray-500">Gênero</dt><dd>{aluno.genero ? GENERO_LABEL[aluno.genero] : "—"}</dd></div>
          </dl>
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
              Em aberto: <strong>{aluno.financeiro.emAberto.toLocaleString("pt-BR")}</strong>
              {aluno.financeiro.proximoVencimento && (
                <span className="ml-2 text-gray-500">
                  · próximo venc. {new Date(aluno.financeiro.proximoVencimento).toLocaleDateString("pt-BR")}
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
                {m.motivo && <div className="text-sm text-gray-600">{m.motivo}</div>}
                {m.observacao && <div className="text-xs text-gray-500">{m.observacao}</div>}
                <div className="text-xs text-gray-400">
                  {m.usuario ?? "sistema"} ·{" "}
                  {new Date(m.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
