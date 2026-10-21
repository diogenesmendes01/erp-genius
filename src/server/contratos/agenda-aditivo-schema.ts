import { z } from "zod";
import { FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { hashSubstituicao } from "./substituicao-estado";

const instante = z.string().datetime({ offset: true });
/** Entrada do cliente: a fonte, os horários antigos e os nomes vêm do banco. */
export const PrepararAgendaAditivoSchema = z.object({ matriculaId: z.string().trim().min(1), encontros: z.array(z.object({ encontroId: z.string().trim().min(1), professorNovoId: z.string().trim().min(1), inicioNovo: instante, fimNovo: instante, duracaoMinutos: z.number().int().positive().max(1440), fusoOrigem: FusoInstitucionalSchema }).strict().superRefine((e, c) => { if (Date.parse(e.fimNovo) - Date.parse(e.inicioNovo) !== e.duracaoMinutos * 60_000) c.addIssue({ code: z.ZodIssueCode.custom, message: "A duração nova não corresponde aos instantes informados." }); })).min(1).max(1000) }).strict().superRefine((p,c)=>{if(new Set(p.encontros.map(e=>e.encontroId)).size!==p.encontros.length)c.addIssue({code:z.ZodIssueCode.custom,message:"Cada encontro só pode constar uma vez na proposta."});});
export const EncontroAgendaAditivoSchema = z.object({
  encontroId: z.string().trim().min(1), professorAnteriorId: z.string().trim().min(1), professorAnteriorNome: z.string().trim().min(1), professorNovoId: z.string().trim().min(1), professorNovoNome: z.string().trim().min(1),
  inicioAnterior: instante, fimAnterior: instante, inicioNovo: instante, fimNovo: instante,
  duracaoMinutos: z.number().int().positive().max(1440), fusoAnterior: FusoInstitucionalSchema, fusoNovo: FusoInstitucionalSchema,
}).strict().superRefine((e, ctx) => {
  if (Date.parse(e.fimAnterior) <= Date.parse(e.inicioAnterior)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "O horário original deve ter fim posterior ao início.", path: ["fimAnterior"] });
  if (Date.parse(e.fimNovo) - Date.parse(e.inicioNovo) !== e.duracaoMinutos * 60_000) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A duração nova não corresponde aos instantes informados.", path: ["fimNovo"] });
});

/** Fotografia interna: o servidor preenche preparadores, fonte, estado anterior e nomes docentes reconsultados. */
export const PropostaAgendaAditivoSchema = z.object({
  matriculaId: z.string().trim().min(1), preparadorId: z.string().trim().min(1), fonteContratualId: z.string().trim().min(1), fonteContratualHash: z.string().regex(/^[a-f0-9]{64}$/), reservaContratualId: z.string().trim().min(1).optional(),
  texto: z.string().trim().min(1).max(4000).default("Agenda"),
  contexto: z.object({ calendarioId: z.string().min(1), calendarioVersao: z.number().int().positive(), fusoInstitucional: FusoInstitucionalSchema,
    aditivos: z.array(z.object({ versaoId: z.string().min(1), propostaId: z.string().min(1), condicoesHash: z.string().regex(/^[a-f0-9]{64}$/), aplicada: z.boolean() })).max(1000),
  }).strict(),
  encontros: z.array(EncontroAgendaAditivoSchema).min(1).max(1000),
}).strict().superRefine((proposta, ctx) => {
  const ids = proposta.encontros.map(e => e.encontroId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cada encontro só pode constar uma vez na proposta.", path: ["encontros"] });
});

export type PropostaAgendaAditivo = z.infer<typeof PropostaAgendaAditivoSchema>;
export function fotografiaCanonicaAgendaAditivo(proposta: z.input<typeof PropostaAgendaAditivoSchema>) { const p = PropostaAgendaAditivoSchema.parse(proposta); return { ...p, encontros: p.encontros.map(e => ({ ...e, inicioAnterior: new Date(e.inicioAnterior).toISOString(), fimAnterior: new Date(e.fimAnterior).toISOString(), inicioNovo: new Date(e.inicioNovo).toISOString(), fimNovo: new Date(e.fimNovo).toISOString() })).sort((a, b) => a.encontroId < b.encontroId ? -1 : a.encontroId > b.encontroId ? 1 : 0) }; }
export function hashPropostaAgendaAditivo(proposta: z.input<typeof PropostaAgendaAditivoSchema>) { return hashSubstituicao(fotografiaCanonicaAgendaAditivo(proposta)); }
export function textoAgendaAditivo(proposta: z.input<typeof PropostaAgendaAditivoSchema>) {
  const d = fotografiaCanonicaAgendaAditivo(proposta);
  const f = (v: string, fuso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: fuso }).format(new Date(v));
  return d.encontros.map(e => `${e.professorAnteriorNome}: ${f(e.inicioAnterior, e.fusoAnterior)}–${f(e.fimAnterior, e.fusoAnterior)} para ${e.professorNovoNome}: ${f(e.inicioNovo, e.fusoNovo)}–${f(e.fimNovo, e.fusoNovo)} (${e.fusoAnterior} -> ${e.fusoNovo})`).join("; ");
}
