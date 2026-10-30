"use client";

import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { botaoClasses } from "@/components/Botao";
import { abrirTurma, voltarTurmaParaPlanejada } from "@/server/turmas/acoes";
import { EstadoVazio } from "@/components/EstadoVazio";
import { formatarDataCivil } from "@/lib/data-civil";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
export interface TurmaRow {
  id: string;
  codigo: string | null;
  nome: string | null;
  online: boolean;
  diasHorario: string | null;
  diasSemana: number[];
  horarioInicio: string | null;
  horarioFim: string | null;
  dataInicio: string | null;
  dataFim: string | null;
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

type AcaoStatus = "abrir" | "voltar";

const TEXTOS_ACAO: Record<AcaoStatus, { titulo: string; descricao: string; confirmar: string }> = {
  abrir: {
    titulo: "Abrir turma para matrícula?",
    descricao: "A turma passará a aparecer em Nova matrícula enquanto houver vaga.",
    confirmar: "Abrir turma",
  },
  voltar: {
    titulo: "Voltar turma para planejada?",
    descricao: "A turma deixará de aparecer em Nova matrícula.",
    confirmar: "Voltar para planejada",
  },
};

function situacao(status: StatusTurma): { label: string; cls: string } {
  const porStatus: Record<StatusTurma, { label: string; cls: string }> = {
    PLANEJADA: { label: "Planejada", cls: "bg-surface-muted text-gray-700" },
    ABERTA: { label: "Aberta", cls: "bg-green-100 text-green-700" },
    EM_ANDAMENTO: { label: "Em andamento", cls: "bg-blue-100 text-blue-700" },
    CONCLUIDA: { label: "Concluída", cls: "bg-gray-200 text-gray-600" },
  };
  return porStatus[status];
}

function DialogoFormularioTurma({ titulo, aoFechar, bloquearFechamento, children }: {
  titulo: string;
  aoFechar: () => void;
  bloquearFechamento: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !bloquearFechamento) aoFechar(); }}>
      <DialogContent
        aria-label={titulo}
        className="max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto sm:w-full"
        onPointerDownOutside={(evento) => { if (bloquearFechamento) evento.preventDefault(); }}
        onEscapeKeyDown={(evento) => { if (bloquearFechamento) evento.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
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
  const [turmaAlterada, setTurmaAlterada] = useState(false);
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);
  const [confirmando, setConfirmando] = useState<null | { id: string; acao: AcaoStatus }>(null);
  const [pendente, setPendente] = useState(false);
  const [erroStatus, setErroStatus] = useState<string | null>(null);
  const pedirConfirmacao = (id: string, acao: AcaoStatus) => { setErroStatus(null); setConfirmando({ id, acao }); };
  const fecharConfirmacao = () => { if (pendente) return; setConfirmando(null); setErroStatus(null); };
  const confirmarStatus = async () => {
    if (!confirmando || pendente) return;
    setPendente(true);
    try {
      const r = confirmando.acao === "abrir" ? await abrirTurma(confirmando.id) : await voltarTurmaParaPlanejada(confirmando.id);
      if (r.ok) { setConfirmando(null); setErroStatus(null); } else setErroStatus(r.erro);
    } catch {
      setErroStatus("Não foi possível alterar o status da turma. Tente novamente.");
    } finally {
      setPendente(false);
    }
  };
  const textos = confirmando ? TEXTOS_ACAO[confirmando.acao] : null;
  const fecharFormulario = () => { setForm("none"); setTurmaAlterada(false); setConfirmandoDescarte(false); };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-80 text-sm text-gray-500">
          Crie a turma e publique a agenda para definir seu período. O status canônico, a agenda e as regras de admissão
          determinam os próximos passos.
        </p>
        {form === "none" && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
        <DialogoFormularioTurma titulo={typeof form === "object" ? "Editar turma" : "Nova turma"} aoFechar={() => { if (turmaAlterada) setConfirmandoDescarte(true); else fecharFormulario(); }} bloquearFechamento={salvandoTurma}>
          {confirmandoDescarte && (
            <div role="alert" className="mb-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-medium">Descartar a turma não salva?</p>
              <p>O que foi preenchido no formulário será perdido.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={fecharFormulario} className={botaoClasses({ variante: "perigo", tamanho: "lg" })}>Descartar alterações</button>
                <button type="button" onClick={() => setConfirmandoDescarte(false)} className={botaoClasses({ variante: "secundario", tamanho: "lg" })}>Continuar editando</button>
              </div>
            </div>
          )}
          <TurmaFormulario
            turma={typeof form === "object" ? form.editar : undefined}
            modalidades={modalidades}
            niveis={niveis}
            professores={professores}
            onClose={fecharFormulario}
            aoMudarOcupado={setSalvandoTurma}
            aoMudarAlterado={setTurmaAlterada}
          />
        </DialogoFormularioTurma>
      )}

      <AlertDialog open={!!confirmando} onOpenChange={(aberto) => { if (!aberto) fecharConfirmacao(); }}>
        {textos && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{textos.titulo}</AlertDialogTitle>
              <AlertDialogDescription>{textos.descricao}</AlertDialogDescription>
            </AlertDialogHeader>
            {erroStatus && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erroStatus}</p>
            )}
            <AlertDialogFooter>
              <Button variante="secundario" disabled={pendente} onClick={fecharConfirmacao}>Cancelar</Button>
              <Button disabled={pendente} onClick={confirmarStatus}>{pendente ? "Salvando..." : textos.confirmar}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      {turmas.length === 0 ? (
        <EstadoVazio bloco>Nenhuma turma cadastrada.</EstadoVazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <Table className="w-full min-w-[640px] text-sm">
            <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
              <TableRow>
                <TableHead className="px-4 py-2 font-medium">Turma</TableHead>
                <TableHead className="px-4 py-2 font-medium">Dias/horário</TableHead>
                <TableHead className="px-4 py-2 font-medium">Período</TableHead>
                <TableHead className="px-4 py-2 font-medium">Professor</TableHead>
                <TableHead className="px-4 py-2 font-medium">Ocupação</TableHead>
                <TableHead className="px-4 py-2 font-medium">Status</TableHead>
                <TableHead className="px-4 py-2 font-medium text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {turmas.map((t) => {
                const vagas = Math.max(0, t.capacidade - t._count.alocacoes - t._count.reservasMatricula);
                const sit = situacao(t.status);
                return (
                  <TableRow key={t.id} className="hover:bg-highlight">
                    <TableCell className="px-4 py-3">
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
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">
                      {t.diasHorario ?? <span className="text-gray-400 italic">a definir</span>}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">
                      {t.dataInicio ? formatarDataCivil(t.dataInicio.slice(0, 10)) : "—"}
                      {t.dataFim ? ` → ${formatarDataCivil(t.dataFim.slice(0, 10))}` : ""}
                      {t.status === "PLANEJADA" && !t.dataFim && (
                        <span className="block text-xs text-gray-500">Previsão de término pendente da grade.</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">{t.professor?.nome ?? "—"}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">
                      {t._count.alocacoes} matriculados · {t._count.reservasMatricula} reservas · {vagas} vagas
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className={"whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium " + sit.cls}>
                        {sit.label}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === "PLANEJADA" && (
                          <Link href={destinoPrepararGrade(t.id)} className="text-xs text-brand-700 hover:text-brand-800">
                            Preparar grade
                          </Link>
                        )}
                        {t.status === "PLANEJADA" && (
                          <Button variante="fantasma" tamanho="sm" onClick={() => pedirConfirmacao(t.id, "abrir")}>Abrir turma</Button>
                        )}
                        {t.status === "ABERTA" && t._count.alocacoes + t._count.reservasMatricula === 0 && (
                          <Button variante="fantasma" tamanho="sm" onClick={() => pedirConfirmacao(t.id, "voltar")}>Voltar para planejada</Button>
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
