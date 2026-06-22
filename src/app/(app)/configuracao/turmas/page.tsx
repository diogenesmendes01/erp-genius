import {
  listarTurmas,
  listarNiveis,
  listarProfessores,
} from "@/server/turmas/consultas";
import { listarModalidades } from "@/server/catalogo/consultas";
import { TurmasPainel, type TurmaRow } from "./TurmasPainel";

export default async function TurmasPage() {
  const [turmas, modalidades, niveis, professores] = await Promise.all([
    listarTurmas(),
    listarModalidades(),
    listarNiveis(),
    listarProfessores(),
  ]);

  const rows: TurmaRow[] = turmas.map((t) => ({
    id: t.id,
    codigo: t.codigo,
    nome: t.nome,
    online: t.online,
    diasHorario: t.diasHorario,
    dataInicio: t.dataInicio ? t.dataInicio.toISOString() : null,
    capacidade: t.capacidade,
    rolling: t.rolling,
    status: t.status,
    modalidadeId: t.modalidadeId,
    nivelId: t.nivelId,
    modalidade: { nome: t.modalidade.nome },
    nivel: { codigo: t.nivel.codigo, idioma: { nome: t.nivel.idioma.nome } },
    professor: t.professor,
    _count: t._count,
  }));

  return (
    <TurmasPainel
      turmas={rows}
      modalidades={modalidades.map((m) => ({ id: m.id, label: m.nome }))}
      niveis={niveis.map((n) => ({ id: n.id, label: `${n.idioma.nome} ${n.codigo}` }))}
      professores={professores.map((p) => ({ id: p.id, label: p.nome }))}
    />
  );
}
