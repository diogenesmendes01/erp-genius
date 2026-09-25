"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import type { StatusTurma } from "@prisma/client";
import {
  destinoPrepararGrade,
  TurmaFormulario,
  type TurmaParaEditar,
  type Opcao,
  type ModalidadeOpcao,
} from "./TurmaFormulario";
import { ImportarTurmasModal } from "./ImportarTurmasModal";
import { useDialogo } from "@/lib/dialogo";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

export interface TurmaRow {
  id: string;
  codigo: string | null;
  nome: string | null;
  online: boolean;
  diasHorario: string | null;
  diasSemana: number[];
  horarioInicio: string | null;
  horarioFim: string | null;
  dataInicio: string | null; // ISO ou null
  dataFim: string | null; // ISO ou null
  capacidade: number;
  rolling: boolean;
  status: StatusTurma;
  modalidadeId: string;
  nivelId: string;
  modalidade: { nome: string };
  nivel: { codigo: string; idioma: { nome: string } };
  professor: { id: string; nome: string } | null;
  regraAvaliacao: { id: string; versao: number } | null;
  _count: { alocacoes: number; reservasMatricula: number };
}

function situacao(status: StatusTurma): { label: string; cls: string } {
  const porStatus: Record<StatusTurma, { label: string; cls: string }> = {
    PLANEJADA: { label: "Planejada", cls: "bg-gray-100 text-gray-700" },
    ABERTA: { label: "Aberta", cls: "bg-green-100 text-green-700" },
    EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-100 text-blue-700" },
    CONCLUIDA: { label: "Concluída", cls: "bg-gray-200 text-gray-600" },
  };
  return porStatus[status];
}

// Casco de diálogo do formulário de turma (E7): TurmaFormulario já desenha o próprio cartão e o
// título ("Nova turma"/"Editar turma"), então aqui não entra o <Modal> compartilhado — ele duplicaria
// o título e o cartão. O comportamento é o mesmo do Modal: role="dialog" + aria-modal, Escape e o
// fundo fecham (menos durante o salvamento), foco preso e devolvido (useDialogo). Alinhado ao topo com rolagem: o formulário é
// mais alto que a tela no celular.
function DialogoFormularioTurma({ titulo, aoFechar, bloquearFechamento, children }: {
  titulo: string;
  aoFechar: () => void;
  bloquearFechamento: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogo(ref, { aberto: true, aoFechar, bloquearFechamento });
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={() => { if (!bloquearFechamento) aoFechar(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="my-8 w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function TurmasPainel({
  turmas,
  modalidades,
  niveis,
  professores,
  podeImportar = false,
}: {
  turmas: TurmaRow[];
  modalidades: ModalidadeOpcao[];
  niveis: Opcao[];
  professores: Opcao[];
  podeImportar?: boolean;
}) {
  const [form, setForm] = useState<"none" | "nova" | { editar: TurmaParaEditar }>("none");
  const [salvandoTurma, setSalvandoTurma] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Crie a turma e publique a agenda para definir seu período. O status canônico, a agenda e as regras de admissão
          determinam os próximos passos.
        </p>
        {form === "none" && (
          <div className="flex items-center gap-2">
            {podeImportar && <ImportarTurmasModal />}
            <button
              onClick={() => setForm("nova")}
              className={botaoClasses({ tamanho: "lg" })}
            >
              <IconPlus className="h-4 w-4" /> Nova turma
            </button>
          </div>
        )}
      </div>

      {form !== "none" && (
        <DialogoFormularioTurma titulo={typeof form === "object" ? "Editar turma" : "Nova turma"} aoFechar={() => setForm("none")} bloquearFechamento={salvandoTurma}>
          <TurmaFormulario
            turma={typeof form === "object" ? form.editar : undefined}
            modalidades={modalidades}
            niveis={niveis}
            professores={professores}
            onClose={() => setForm("none")}
            aoMudarOcupado={setSalvandoTurma}
          />
        </DialogoFormularioTurma>
      )}

      {turmas.length === 0 ? (
        <EstadoVazio bloco>Nenhuma turma cadastrada.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Turma</th>
                <th className="px-4 py-2 font-medium">Dias/horário</th>
                <th className="px-4 py-2 font-medium">Período</th>
                <th className="px-4 py-2 font-medium">Professor</th>
                <th className="px-4 py-2 font-medium">Ocupação</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {turmas.map((t) => {
                // _count.alocacoes já vem filtrado por { ativa: true } (ver listarTurmas).
                const vagas = Math.max(0, t.capacidade - t._count.alocacoes - t._count.reservasMatricula);
                const sit = situacao(t.status);
                return (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/academico/regras/turmas/${t.id}`} className="text-xs text-gray-600 underline">{t.regraAvaliacao ? `Avaliações: versão ${t.regraAvaliacao.versao}` : "Regras de avaliação pendentes de vinculação"}</Link>
                      <div className="font-medium text-gray-800">
                        {t.nome ? t.nome : `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo}`}
                        <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                          {t.online ? "online" : "presencial"}
                        </span>
                        {t.rolling && (
                          <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                            rolling
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {t.nome ? `${t.modalidade.nome} · ${t.nivel.idioma.nome} ${t.nivel.codigo} · ` : ""}
                        {t.codigo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.diasHorario ?? <span className="text-gray-400 italic">a definir</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {t.dataInicio ? new Date(t.dataInicio).toLocaleDateString("pt-BR") : "—"}
                      {t.dataFim ? ` → ${new Date(t.dataFim).toLocaleDateString("pt-BR")}` : ""}
                      {t.status === "PLANEJADA" && !t.dataFim && (
                        <span className="block text-xs text-gray-500">Previsão de término pendente da grade.</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.professor?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {t._count.alocacoes} matriculados · {t._count.reservasMatricula} reservas · {vagas} vagas
                    </td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2 py-0.5 text-xs font-medium " + sit.cls}>
                        {sit.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === "PLANEJADA" && (
                          <Link href={destinoPrepararGrade(t.id)} className="text-xs text-brand-700 hover:text-brand-800">
                            Preparar grade
                          </Link>
                        )}
                        <button
                          onClick={() =>
                            setForm({
                              editar: {
                                id: t.id,
                                nome: t.nome ?? "",
                                modalidadeId: t.modalidadeId,
                                nivelId: t.nivelId,
                                professorId: t.professor?.id ?? "",
                                diasSemana: t.diasSemana,
                                horarioInicio: t.horarioInicio ?? "",
                                horarioFim: t.horarioFim ?? "",
                                dataInicio: t.dataInicio ? t.dataInicio.slice(0, 10) : "",
                                dataFim: t.dataFim ? t.dataFim.slice(0, 10) : "",
                                capacidade: t.capacidade,
                                rolling: t.rolling,
                              },
                            })
                          }
                          className={botaoClasses({ variante: "fantasma", tamanho: "sm" })}
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
