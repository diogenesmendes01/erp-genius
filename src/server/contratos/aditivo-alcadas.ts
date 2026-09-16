"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessao, ErroPermissao, ErroRegra } from "@/server/_shared";
import { AlcadaAditivoSchema, alcadasAplicaveisAditivo, camposDaAlcadaAditivo } from "./aditivo-alcadas-regras";
import { decidirAlcadaAditivoTx } from "./aditivo-alcadas-tx";
import { ProjecaoAditivoSchema } from "./aditivo-projecao";
import { hashSubstituicao } from "./substituicao-estado";

const id = z.string().trim().min(1).max(100);
const DecidirSchema = z.object({ matriculaId: id, propostaId: id, propostaHash: z.string().regex(/^[a-f0-9]{64}$/), alcada: AlcadaAditivoSchema, aprovada: z.boolean(), motivo: z.string().trim().min(5).max(2000) }).strict();
function visiveis(papeis: Papel[]) {
  if (papeis.includes(Papel.ADMINISTRADOR) || papeis.includes(Papel.SECRETARIA_ACADEMICA)) return AlcadaAditivoSchema.options;
  return [papeis.includes(Papel.FINANCEIRO) ? "FINANCEIRA" : null, papeis.includes(Papel.GERENTE_COMERCIAL) ? "COMERCIAL" : null, papeis.includes(Papel.GERENTE_PEDAGOGICO) ? "PEDAGOGICA" : null].filter((x): x is z.infer<typeof AlcadaAditivoSchema> => x !== null);
}
function podeDecidir(papeis: Papel[], permissoes: string[], alcada: z.infer<typeof AlcadaAditivoSchema>) {
  if (papeis.includes(Papel.ADMINISTRADOR)) return true;
  return alcada === "FINANCEIRA" ? papeis.includes(Papel.FINANCEIRO) && permissoes.includes("financeiro.aprovar_acertos")
    : alcada === "COMERCIAL" ? papeis.includes(Papel.GERENTE_COMERCIAL) : papeis.includes(Papel.GERENTE_PEDAGOGICO);
}

export async function decidirAlcadaAditivo(input: z.input<typeof DecidirSchema>) {
  return executarAcao(async () => {
    const ator = await exigirSessao(), d = DecidirSchema.parse(input);
    return prisma.$transaction(tx => decidirAlcadaAditivoTx(tx, ator.id, d), { timeout: 20000 });
  });
}
export async function consultarAlcadasAditivo(input: { matriculaId: string; propostaId: string }) {
  return executarAcao(async () => {
    const ator = await exigirSessao(), d = z.object({ matriculaId: id, propostaId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const fresco = await tx.usuario.findUnique({ where: { id: ator.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!fresco?.ativo) throw new ErroPermissao();
      const permitidas = visiveis(fresco.papeis);
      if (!permitidas.length) throw new ErroPermissao();
      const p = await tx.propostaAditivoContratual.findFirst({ where: { id: d.propostaId, matriculaId: d.matriculaId }, include: { decisao: true } });
      if (!p || hashSubstituicao(p.snapshot) !== p.entradaHash) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const alteracoes = ProjecaoAditivoSchema.parse(p.snapshot).alteracoes, aplicaveis = alcadasAplicaveisAditivo(alteracoes).filter(a => permitidas.includes(a));
      const superada = await tx.propostaAditivoContratual.count({ where: { matriculaId: p.matriculaId, versao: { gt: p.versao } } }) > 0;
      const decisoes = await tx.decisaoAlcadaAditivo.findMany({ where: { propostaId: p.id, alcada: { in: aplicaveis } }, select: { alcada: true, aprovada: true, motivo: true, propostaHash: true, decididaEm: true, decisor: { select: { nome: true } } } });
      const aprovacaoGenericaOk = p.decisao?.aprovada === true && p.decisao.propostaHash === p.entradaHash;
      const podeDecidirAlcadas = aprovacaoGenericaOk && !superada && p.preparadaPorId !== ator.id
        ? aplicaveis.filter(alcada => !decisoes.some(decisao => decisao.alcada === alcada) && podeDecidir(fresco.papeis, fresco.permissoes, alcada)) : [];
      return { propostaId: p.id, propostaHash: p.entradaHash, versao: p.versao, vigenciaInicio: p.vigenciaInicio.toISOString(), superada,
        estado: aprovacaoGenericaOk ? "APROVACAO_ADMINISTRATIVA_OK" : "AGUARDANDO_APROVACAO_ADMINISTRATIVA",
        alcadas: aplicaveis.map(alcada => ({ alcada, campos: camposDaAlcadaAditivo(alcada, alteracoes), decisao: decisoes.find(d => d.alcada === alcada) ?? null })), podeDecidir: podeDecidirAlcadas };
    }, { isolationLevel: "RepeatableRead" });
  });
}
