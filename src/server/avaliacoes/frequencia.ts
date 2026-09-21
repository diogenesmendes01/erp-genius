import { Prisma } from "@prisma/client";
import { z } from "zod";

const id = z.string().min(1);
const instante = z.string().datetime();
const entradaSchema = z.object({
  matriculaId: id, nivelId: id, apuradaEm: instante,
  minimoPercentual: z.string().regex(/^\d+(\.\d+)?$/).max(30),
  // O carregador deve conferir vínculo, situação histórica e equivalência antes
  // de incluir uma aula. Esta função não concede acesso nem aprova reposições.
  aulas: z.array(z.object({
    aulaId: id, matriculaId: id, nivelId: id, fim: instante,
    situacao: z.enum(["PREVISTA", "MINISTRADA", "CANCELADA"]),
    participacao: z.enum(["PRESENTE", "FALTA", "IMPEDIDO_POR_RESTRICAO", "PENDENTE"]),
    reposicoes: z.array(z.object({
      id, aulaOriginalId: id, matriculaId: id,
      modalidade: z.enum(["PARTICULAR", "GRAVACAO"]),
      validadaEm: instante.nullable(),
    }).strict()).default([]),
  }).strict()),
}).strict();

/** Apuração por encontros, sem arredondar o percentual para decidir o mínimo. */
export function apurarFrequenciaNivel(entrada: z.input<typeof entradaSchema>) {
  const d = entradaSchema.parse(entrada);
  const minimo = new Prisma.Decimal(d.minimoPercentual);
  if (minimo.gt(100)) throw new Error("Mínimo de frequência fora do intervalo de 0 a 100.");
  const agora = Date.parse(d.apuradaEm);
  const aulas = new Set<string>(), reposicoes = new Set<string>();
  let base = 0, presencas = 0, regularizadas = 0, faltas = 0, impedimentos = 0;
  const pendencias: { aulaId: string; motivo: "CONCLUSAO_DA_AULA" | "CHAMADA" }[] = [];
  const memoria = [...d.aulas].sort((a, b) => a.fim.localeCompare(b.fim) || a.aulaId.localeCompare(b.aulaId)).map(a => {
    if (a.matriculaId !== d.matriculaId || a.nivelId !== d.nivelId) throw new Error("Aula de outro contrato ou nível na frequência.");
    if (aulas.has(a.aulaId)) throw new Error("Aula original duplicada na frequência.");
    aulas.add(a.aulaId);
    for (const r of a.reposicoes) {
      if (r.matriculaId !== d.matriculaId || r.aulaOriginalId !== a.aulaId) throw new Error("Reposição não corresponde ao contrato e à aula original.");
      if (reposicoes.has(r.id)) throw new Error("Reposição duplicada na apuração.");
      reposicoes.add(r.id);
      if (r.validadaEm && (Date.parse(r.validadaEm) > agora || Date.parse(r.validadaEm) < Date.parse(a.fim))) throw new Error("Data de validação da reposição incompatível com a apuração.");
    }
    const validada = a.reposicoes.filter(r => r.validadaEm !== null).sort((x, y) => x.validadaEm!.localeCompare(y.validadaEm!) || x.id.localeCompare(y.id))[0];
    if (a.situacao !== "MINISTRADA" && validada) throw new Error("Reposição concluída sem aula original ministrada conferida.");
    const futura = Date.parse(a.fim) > agora;
    if (futura && a.situacao === "MINISTRADA") throw new Error("Aula ministrada no futuro.");
    let resultado: "PRESENTE" | "REPOSTA" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | "PENDENTE" | "FORA_DA_BASE" = "FORA_DA_BASE";
    if (a.situacao === "PREVISTA" && !futura) pendencias.push({ aulaId: a.aulaId, motivo: "CONCLUSAO_DA_AULA" });
    if (a.situacao === "MINISTRADA") {
      base++;
      if (a.participacao === "PRESENTE") { presencas++; resultado = "PRESENTE"; }
      else if (a.participacao === "PENDENTE") {
        if (validada) throw new Error("Confira a ausência original antes de regularizar a frequência.");
        pendencias.push({ aulaId: a.aulaId, motivo: "CHAMADA" }); resultado = "PENDENTE";
      } else if (validada) { regularizadas++; resultado = "REPOSTA"; }
      else if (a.participacao === "FALTA") { faltas++; resultado = "FALTA"; }
      else { impedimentos++; resultado = "IMPEDIDO_POR_RESTRICAO"; }
    }
    return { aulaId: a.aulaId, situacaoOriginal: a.situacao, participacaoOriginal: a.participacao, resultado,
      reposicaoId: resultado === "REPOSTA" ? validada!.id : null,
      repostaEm: resultado === "REPOSTA" ? validada!.validadaEm : null };
  });
  const contabilizadas = presencas + regularizadas;
  return { matriculaId: d.matriculaId, nivelId: d.nivelId, apuradaEm: d.apuradaEm,
    base, presencas, regularizadas, faltas, impedimentos, contabilizadas, pendencias, memoria,
    percentual: base ? { numerador: String(contabilizadas * 100), denominador: String(base) } : null,
    minimoPercentual: d.minimoPercentual,
    atendeMinimo: base && !pendencias.length ? new Prisma.Decimal(contabilizadas).times(100).gte(minimo.times(base)) : null,
  };
}
