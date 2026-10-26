import {carregarCadastroPessoaAutorizado,type InformacoesCadastroPessoa} from "@/server/crm/pessoa-cadastro";
import type {CadastroPessoa} from "@/server/crm/pessoa-cadastro-schema";
import {capacidadesCrm} from "@/server/crm/permissoes";
import {apenasPortal} from "@/server/_shared/sessao";
import { carregarContadorAtividadeAria } from "./historico-aria-leitura";
import type { EtapaLead, OrigemCanal, PapelParticipante, Prisma } from "@prisma/client";
import { hrefConversa } from "@/lib/href-conversa";
import { atendimentosParaPessoas } from "./atalhos";
import { prisma } from "@/lib/prisma";
import { PAPEL_PARTICIPANTE_LABEL } from "@/lib/labels";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { camposDaPessoa, tagsAtivas, type CampoDaFicha } from "@/server/crm/ficha-dados";
import { escopoPessoas } from "@/server/crm/pessoas";
import { escopoAtendimentos, type Db } from "@/server/whatsapp/escopo";
import { podeVerLeadNaThread } from "@/server/whatsapp/consultas-inbox";
import { comContatoIndividual } from "@/server/whatsapp/grupos";
import { nomeEFonteDoAtendimento } from "@/server/whatsapp/nome-contato";
import { atendimentoVisivel } from "@/server/whatsapp/atendimentos";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { CHAVE_LINHA } from "@/server/whatsapp/linha-comercial";
import { capacidadesPainel, type CapacidadesPainel } from "./permissoes";

export type ClienteVoltouPainel = { oportunidadeId: string; titulo: string; situacao: "ganha" | "perdida"; contatoId: string; podeVincular: boolean };
export type CabecalhoPainel = { contadorAtividade: number; clienteVoltou: ClienteVoltouPainel | null; pessoaId: string | null; tagsDisponiveis: { id: string; nome: string }[]; subtitulo: string | null; quadrado: boolean; semNome: boolean; capacidades: CapacidadesPainel };
export type CampoPainel = CampoDaFicha & { ia: boolean };
export type PessoaPainel = { id: string; nome: string; email: string | null; cidade: string | null; cargo: string | null; linkedin: string | null; origemCanal: OrigemCanal | null; telefone: string | null; empresa: { id: string; nome: string; documento: string | null; segmentoMercado: string | null; porte: string | null; site: string | null } | null };
export type ResumoOportunidadePainel = { id: string; titulo: string; produto: string | null; valor: string | null; moeda: string | null; etapa: EtapaLead; b2b: boolean };
export type BlocoB2BPainel = { empresa: { id: string; nome: string }; participantes: { pessoaId: string; nome: string; papel: PapelParticipante; cargo: string | null; naConversa: boolean; hrefConversa: string | null }[]; decisor: boolean | null };
export type DetalhesPainel = { cadastroPessoa:CadastroPessoa|null; informacoesCadastro:InformacoesCadastroPessoa|null; pessoa: PessoaPainel | null; oportunidade: ResumoOportunidadePainel | null; b2b: BlocoB2BPainel | null; campos: CampoPainel[] };

export function subtituloContato(i: { b2b: boolean; produto: string | null; cargo: string | null; empresa: string | null; interlocutor: { nome: string; papel: PapelParticipante } | null }): string {
  if (!i.b2b) return i.produto ? "Pessoa física · " + i.produto : "Pessoa física";
  if (i.interlocutor) return "Falando com " + i.interlocutor.nome + " · " + PAPEL_PARTICIPANTE_LABEL[i.interlocutor.papel];
  return [i.cargo, i.empresa].filter(Boolean).join(" · ");
}

/** Eventos já ordenados do mais recente ao mais antigo, com desempate estável na consulta. */
export function autoriaDosCampos(eventos: readonly { campoId: string; autorId: string | null }[]): Map<string, boolean> {
  const autoria = new Map<string, boolean>();
  for (const e of eventos) if (!autoria.has(e.campoId)) autoria.set(e.campoId, e.autorId === null);
  return autoria;
}

const pessoaSelect = {
  id: true, nome: true, email: true, cidade: true, cargo: true, linkedin: true, origemCanal: true,
  responsavel: { select: { id: true } },
  empresa: { select: { id: true, nome: true, documento: true, segmentoMercado: true, porte: true, site: true } },
} satisfies Prisma.PessoaSelect;

/** Uma resolução de identidade para cabeçalho, Detalhes e tags. Escopo vem ANTES dos dados de Pessoa. */
async function contextoPainel(u: UsuarioSessao, atendimentoId: string, db: Db) {
  const achado = await db.atendimentoWhatsApp.findFirst({
    where: { AND: [{ id: atendimentoId }, await escopoAtendimentos(u, { db })] },
    select: {
      id: true, finalidade: true, leadId: true, encerradoEm: true,
      aluno: { select: { primeiroNome: true, sobrenome: true } },
      lead: { select: { nome: true } },
      conversa: { select: { id: true, grupoId: true, numero: { select: { finalidade: true, ativo: true } }, contato: { select: { id: true, leadId: true, pessoaId: true, nomeExibicao: true, nomePerfil: true, telefoneE164: true, responsavel: { select: { nome: true } } } } } },
    },
  });
  if (!achado) return null;
  const a = comContatoIndividual(achado);
  const comercial = a.finalidade === "COMERCIAL";
  const veLead = comercial && !!a.leadId && await podeVerLeadNaThread(u, a.id, a.leadId, Date.now(), db);
  const op = veLead && a.leadId ? await db.oportunidade.findUnique({
    where: { id: a.leadId },
    select: { id: true, nome: true, planoPrevisto: true, valorPrevisto: true, etapa: true, b2b: true,
      pais: { select: { moedaLocal: true } }, pessoa: { select: pessoaSelect },
      empresa: { select: { id: true, nome: true } },
      participantes: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { pessoaId: true, papel: true, pessoa: { select: { nome: true, cargo: true } } } },
    },
  }) : null;
  // Não há fallback se existe lead, ainda que negado, sem Pessoa ou com responsável legal.
  const pessoa = op ? (op.pessoa?.responsavel ? null : op.pessoa) : comercial && !a.leadId && a.conversa.contato.pessoaId
    ? await db.pessoa.findFirst({ where: { AND: [{ id: a.conversa.contato.pessoaId, responsavel: null }, await escopoPessoas(u, db)] }, select: pessoaSelect }) : null;
  const interlocutor = op?.participantes.find(p => p.pessoaId === a.conversa.contato.pessoaId) ?? null;
  return { a, op, pessoa, interlocutor };
}

/** Db opcional inclui TODA a autorização; nenhuma conexão global é pedida em uma tx. */
export async function pessoaDoAtendimento(u: UsuarioSessao, atendimentoId: string, db: Db = prisma): Promise<{ pessoaId: string; leadId: string | null } | null> {
  const c = await contextoPainel(u, atendimentoId, db);
  return c?.pessoa ? { pessoaId: c.pessoa.id, leadId: c.op?.id ?? null } : null;
}

/** Leitura de retorno escolhe a oportunidade antes de avaliar telefone; nenhum fallback por telefone. */
async function retornoDoCliente(u: UsuarioSessao, c: NonNullable<Awaited<ReturnType<typeof contextoPainel>>>, db: Db): Promise<ClienteVoltouPainel | null> {
  const { a, pessoa } = c;
  if (a.finalidade !== "COMERCIAL" || a.leadId || !pessoa) return null;
  const op = await db.oportunidade.findFirst({
    where: { AND: [{ pessoaId: pessoa.id, etapa: { in: ["MATRICULADO", "PERDIDO"] } }, await escopoComercialAtual(u, db)] },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    select: { id: true, nome: true, etapa: true, telefoneE164: true },
  });
  if (!op) return null;
  const contato = a.conversa.contato;
  let podeVincular = false;
  if (u.papeis.some(p => p === "ADMINISTRADOR" || p === "VENDEDOR" || p === "GERENTE_COMERCIAL") &&
      !a.encerradoEm && !a.conversa.grupoId && a.conversa.numero.finalidade === "VENDAS" && a.conversa.numero.ativo &&
      contato.telefoneE164 === op.telefoneE164 && (!contato.leadId || contato.leadId === op.id)) {
    const alcance = await atendimentoVisivel(u, a.id, true, db);
    if (alcance?.contatoId === contato.id && alcance.finalidade === "COMERCIAL" &&
        alcance.contato.pessoaId === pessoa.id && alcance.contato.telefoneE164 === op.telefoneE164 &&
        (!alcance.contato.leadId || alcance.contato.leadId === op.id)) {
      // Mesma preferência de garantirAtendimento: não oferecer vínculo que selecionaria outra identidade.
      const abertos = await db.atendimentoWhatsApp.findMany({
        where: { conversaId: a.conversa.id, finalidade: "COMERCIAL", encerradoEm: null },
        orderBy: [{ ultimaMensagemEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }],
        select: { id: true, leadId: true, contextoChave: true },
      });
      const candidato = abertos.find(outro => outro.leadId === op.id) ?? abertos.find(outro => outro.contextoChave.startsWith(CHAVE_LINHA)) ?? abertos[0];
      podeVincular = candidato?.id === a.id && (!candidato.leadId || candidato.leadId === op.id);
    }
  }
  return { oportunidadeId: op.id, titulo: op.nome, situacao: op.etapa === "MATRICULADO" ? "ganha" : "perdida", contatoId: contato.id, podeVincular };
}
export async function carregarCabecalhoPainel(u: UsuarioSessao, atendimentoId: string): Promise<CabecalhoPainel | null> {
  const c = await contextoPainel(u, atendimentoId, prisma);
  if (!c) return null;
  const { a, op, pessoa, interlocutor } = c;
  const capacidades = capacidadesPainel(u, { finalidade: a.finalidade, veLead: !!op });
  const { fonte } = nomeEFonteDoAtendimento(a);
  return {
    contadorAtividade: await carregarContadorAtividadeAria(u, atendimentoId),
    clienteVoltou: await retornoDoCliente(u, c, prisma),
    pessoaId: pessoa?.id ?? null,
    tagsDisponiveis: pessoa && capacidades.editarTags ? (await tagsAtivas()).map(({ id, nome }) => ({ id, nome })) : [],
    subtitulo: a.finalidade === "COMERCIAL" ? subtituloContato({ b2b: op?.b2b ?? false, produto: op ? op.planoPrevisto ?? op.nome : null, cargo: pessoa?.cargo ?? null, empresa: op?.empresa?.nome ?? null, interlocutor: interlocutor ? { nome: interlocutor.pessoa.nome, papel: interlocutor.papel } : null }) : null,
    quadrado: op?.b2b === true,
    semNome: fonte === "contato" && !a.conversa.contato.nomeExibicao?.trim() && !a.conversa.contato.nomePerfil?.trim(),
    capacidades,
  };
}

/** Os blocos novos têm gate próprio; a projeção antiga Pessoa409 permanece literal. */
async function cadastroDoContexto(u:UsuarioSessao,c:NonNullable<Awaited<ReturnType<typeof contextoPainel>>>) {
 if(c.a.finalidade!=="COMERCIAL"||!c.pessoa)return null;
 const row=await prisma.usuario.findUnique({where:{id:u.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
 if(!row?.ativo||apenasPortal(row)||!capacidadesCrm(row.papeis).has("contatos.ver"))return null;
 const cadastro=await carregarCadastroPessoaAutorizado(prisma,row.id,c.pessoa.id);if(!cadastro)return null;
 const atual=await contextoPainel(row,c.a.id,prisma);
 if(!atual||atual.a.finalidade!=="COMERCIAL"||atual.pessoa?.id!==c.pessoa.id||atual.a.leadId!==c.a.leadId||atual.a.conversa.id!==c.a.conversa.id||atual.a.conversa.contato.id!==c.a.conversa.contato.id||atual.a.conversa.contato.pessoaId!==c.a.conversa.contato.pessoaId||atual.a.conversa.contato.leadId!==c.a.conversa.contato.leadId)return null;
 const final=await prisma.usuario.findUnique({where:{id:u.id},select:{id:true,nome:true,papeis:true,permissoes:true,ativo:true}});
 if(!final?.ativo||apenasPortal(final)||!capacidadesCrm(final.papeis).has("contatos.ver")||JSON.stringify(final.papeis)!==JSON.stringify(row.papeis))return null;
 return cadastro;
}
export async function carregarDetalhesPainel(u: UsuarioSessao, atendimentoId: string): Promise<DetalhesPainel | null> {
  const c = await contextoPainel(u, atendimentoId, prisma);
  if (!c) return null;
  const { a, op, pessoa, interlocutor } = c;
  let campos: CampoPainel[] = [];
  if (pessoa) {
    const [ficha, eventos] = await Promise.all([
      camposDaPessoa(pessoa.id, u),
      prisma.$queryRaw<{ campoId: string; autorId: string | null }[]>`
        SELECT DISTINCT ON (payload ->> 'campoId')
          payload ->> 'campoId' AS "campoId", "autorId"
        FROM "Evento"
        WHERE tipo = 'CampoPersonalizadoAlterado' AND "agregadoTipo" = 'Pessoa'
          AND "agregadoId" = ${pessoa.id}
          AND jsonb_typeof(payload -> 'campoId') = 'string'
        ORDER BY payload ->> 'campoId', "criadoEm" DESC, id DESC
      `,
    ]);
    // A projeção SQL traz só campoId/autorId do último evento. Não carrega o JSON sensível.
    const autoria = autoriaDosCampos(eventos);
    campos = ficha.map(campo => ({ ...campo, ia: autoria.get(campo.id) ?? false }));
  }
  const conversas = op?.b2b && op.empresa ? await atendimentosParaPessoas(u, op.participantes.map(p => p.pessoaId)) : new Map();
  const cadastro=await cadastroDoContexto(u,c);
  return {
    cadastroPessoa:cadastro?.valores??null,informacoesCadastro:cadastro?.informacoes??null,
    pessoa: pessoa ? { id: pessoa.id, nome: pessoa.nome, email: pessoa.email, cidade: pessoa.cidade, cargo: pessoa.cargo, linkedin: pessoa.linkedin, origemCanal: pessoa.origemCanal, telefone: a.conversa.contato.telefoneE164, empresa: pessoa.empresa } : null,
    oportunidade: op ? { id: op.id, titulo: op.nome, produto: op.planoPrevisto, valor: op.valorPrevisto?.toFixed(2) ?? null, moeda: op.pais?.moedaLocal ?? null, etapa: op.etapa, b2b: op.b2b } : null,
    b2b: op?.b2b && op.empresa ? { empresa: op.empresa, participantes: op.participantes.map(p => ({ pessoaId: p.pessoaId, nome: p.pessoa.nome, papel: p.papel, cargo: p.pessoa.cargo, naConversa: p.pessoaId === a.conversa.contato.pessoaId, hrefConversa: conversas.has(p.pessoaId) ? hrefConversa(conversas.get(p.pessoaId)!.atendimentoId) : null })), decisor: interlocutor ? interlocutor.papel === "DECISOR" : null } : null,
    campos,
  };
}
