import { Papel } from "@prisma/client";
import { exigirSessaoPagina } from "@/server/_shared";
import {
  listarTurmas,
  listarNiveis,
  listarProfessores,
} from "@/server/turmas/consultas";
import { listarModalidades } from "@/server/catalogo/consultas";
import { TurmasPainel, type TurmaRow } from "./TurmasPainel";

export default async function TurmasPage() {
  const usuario = await exigirSessaoPagina(Papel.GERENTE_PEDAGOGICO);
  const [turmas, modalidades, niveis, professores] = await Promise.all([
    listarTurmas(),
    listarModalidades(),
    listarNiveis(),
    listarProfessores(),
  ]);
  // Importar turmas em lote é exclusivo do Administrador (doc 12).
  const podeImportar = usuario.papeis.includes(Papel.ADMINISTRADOR);

  const rows: TurmaRow[] = turmas.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    nome: t.nome,
    online: t.online,
    diasHorario: t.diasHorario,
    diasSemana: t.diasSemana,
    horarioInicio: t.horarioInicio,
    horarioFim: t.horarioFim,
    dataInicio: t.dataInicio ? t.dataInicio.toISOString() : null,
    dataFim: t.dataFim ? t.dataFim.toISOString() : null,
    capacidade: t.capacidade,
    rolling: t.rolling,
    modalidadeId: t.modalidadeId,
    nivelId: t.nivelId,
    modalidade: { nome: t.modalidade.nome },
    nivel: { codigo: t.nivel.codigo, idioma: { nome: t.nivel.idioma.nome } },
    professor: t.professor,
    regraAvaliacao: t.regraAvaliacao,
    _count: t._count,
  }));

  return (
    <TurmasPainel
      turmas={rows}
      modalidades={modalidades.map((m) => ({ id: m.id, label: m.nome, frequencia: m.frequencia }))}
      niveis={niveis.map((n) => ({ id: n.id, label: `${n.idioma.nome} ${n.codigo}` }))}
      professores={professores.map((p) => ({ id: p.id, label: p.nome }))}
      podeImportar={podeImportar}
    />
  );
}
