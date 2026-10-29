"use server";
import {preverNotificadosTarefaInbox,type PedidoPreviaNotificadosTarefa,type PreviaNotificadosTarefa} from "./tarefas-edicao";

import {cancelarAgendadaInboxTx} from "./agendadas-cancelamento";
import {dadosTarefaModal,criarTarefaInbox,editarTarefaInbox,type DadosModalTarefa,type CriarTarefaInboxInput,type EditarTarefaInboxInput} from "./tarefas-edicao";
import { z } from "zod";
import type { DecisaoMensagemAgendada } from "@/lib/selo-mensagem-agendada";
import { executarTarefaInboxTx, type ReagendamentoInbox } from "./tarefas-transicoes";
import { EtapaLead, Papel, type Prisma } from "@prisma/client";
import { AgendarExperimentalSchema, type AgendarExperimentalInput } from "@/server/comercial/schema";
import { EVENTO_EXPERIMENTAL_ATRIBUIDA, professorAtribuido } from "@/server/comercial/experimental";
import { exigirInstanteDoCampoLocal } from "@/server/_shared/campo-local";
import { registrarEvento } from "@/server/_shared";
import { moverEtapaTx } from "@/server/crm/mover-etapa";
import { revalidatePath } from "next/cache";
import { PerdaSchema, type PerdaInput } from "@/server/comercial/schema";
import { marcarPerdidoTx } from "@/server/crm/marcar-perdido";
import { destinoDoArraste } from "@/server/crm/etapas";
import { comOportunidadeDoInboxTx } from "./contexto-oportunidade";
import { prisma } from "@/lib/prisma";
import { executarAcao, type Resultado } from "@/server/_shared/resultado";
import { ErroRegra, exigirSessao, apenasPortal } from "@/server/_shared/sessao";
import { alterarTagNaTransacao, criarOuObterTagNaTransacao } from "@/server/crm/tags";
import { EditarPessoaSchema, editarPessoaNaTransacao, type EditarPessoaInput } from "@/server/crm/contatos";
import { definirValorCampoNaTransacao, validarValorCampo } from "@/server/crm/campos";
import { capacidadesPainel } from "./permissoes";
import { pessoaDoAtendimento } from "./painel-detalhes";
import { avisarAtendimento } from "./aviso";
import {temCadastroPessoa,erroSeguroCadastroPessoa} from "@/server/crm/pessoa-cadastro";
import {capacidadesCrm} from "@/server/crm/permissoes";
import {escopoPessoas} from "@/server/crm/pessoas";

const Id = z.string().min(1, "Contato não encontrado.");
async function executarTag(atendimentoId: string, entrada: { tipo: "atribuir" | "remover"; tagId: string } | { tipo: "criar"; nome: string }): Promise<Resultado<{ tagId: string }>> {
  return executarAcao(async () => {
    const usuario = await exigirSessao(); const id = Id.parse(atendimentoId);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const pessoa = await pessoaDoAtendimento(usuario, id, tx);
      if (!pessoa) throw new ErroRegra("Contato não encontrado.");
      const capacidades = capacidadesPainel(usuario, { finalidade: "COMERCIAL", veLead: pessoa.leadId !== null });
      if (!capacidades.editarTags || (entrada.tipo === "criar" && !capacidades.criarTag)) throw new ErroRegra("Você não tem acesso a esta função do CRM.");
      const tagId = entrada.tipo === "criar" ? (await criarOuObterTagNaTransacao(tx, usuario, { nome: entrada.nome, cor: "NEUTRA" })).id : entrada.tagId;
      const mudou = await alterarTagNaTransacao(tx, usuario, { pessoaId: pessoa.pessoaId, tagId }, entrada.tipo === "remover" ? "remover" : "atribuir", async () => {
        const atual = await pessoaDoAtendimento(usuario, id, tx);
        if (!atual || atual.pessoaId !== pessoa.pessoaId || atual.leadId !== pessoa.leadId) throw new ErroRegra("O contato mudou enquanto você editava. Recarregue o painel e tente de novo.");
        const agora = capacidadesPainel(usuario, { finalidade: "COMERCIAL", veLead: atual.leadId !== null });
        if (!agora.editarTags || (entrada.tipo === "criar" && !agora.criarTag)) throw new ErroRegra("Você não tem acesso a esta função do CRM.");
      });
      if (mudou) await avisarAtendimento(tx, id);
      return { tagId };
    });
  });
}
export async function atribuirTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado> {
  const r = await executarTag(atendimentoId, { tipo: "atribuir", tagId }); return r.ok ? { ok: true } : r;
}
export async function removerTagNoInbox(atendimentoId: string, tagId: string): Promise<Resultado> {
  const r = await executarTag(atendimentoId, { tipo: "remover", tagId }); return r.ok ? { ok: true } : r;
}
export async function criarEAtribuirTagNoInbox(atendimentoId: string, nome: string): Promise<Resultado<{ tagId: string }>> {
  return executarTag(atendimentoId, { tipo: "criar", nome });
}

const EdicaoContatoSchema = z.object({
  pessoaIdEsperada: z.string().min(1, "Reabra a ficha para confirmar o contato."),
  pessoa: EditarPessoaSchema.omit({ empresaId: true }).strict().optional(),
  campos: z.array(z.object({ campoId: z.string().min(1), valor: z.unknown() }).strict()).optional(),
}).strict();
export type EditarContatoInbox = { pessoaIdEsperada: string; pessoa?: Omit<EditarPessoaInput, "empresaId">; campos?: { campoId: string; valor: unknown }[] };

export async function editarContatoNoInbox(atendimentoId: string, input: EditarContatoInbox): Promise<Resultado> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const dados = EdicaoContatoSchema.parse(input), id = Id.parse(atendimentoId);
    const cadastroSolicitado=temCadastroPessoa(dados.pessoa);
    const ids = (dados.campos ?? []).map(c => c.campoId);
    if (new Set(ids).size !== ids.length) throw new ErroRegra("Não repita o mesmo campo.");
    await prisma.$transaction(async tx => {
      if(cadastroSolicitado)await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR NO KEY UPDATE`;
      else await tx.$queryRaw`SELECT id FROM "AtendimentoWhatsApp" WHERE id = ${id} FOR UPDATE`;
      const lerBindingCadastro=()=>tx.atendimentoWhatsApp.findUnique({where:{id},select:{id:true,finalidade:true,leadId:true,conversaId:true,conversa:{select:{contatoId:true,contato:{select:{id:true,pessoaId:true,leadId:true}}}}}});
      const bindingCadastro=cadastroSolicitado?await lerBindingCadastro():null;
      if(cadastroSolicitado&&bindingCadastro?.finalidade!=="COMERCIAL")throw new ErroRegra("Contato não encontrado.");
      const autor = { ...sessao, papeis: [...sessao.papeis] };
      const pessoa = await pessoaDoAtendimento(autor, id, tx);
      if (!pessoa) throw new ErroRegra("Contato não encontrado.");
      if (pessoa.pessoaId !== dados.pessoaIdEsperada) throw new ErroRegra("O contato mudou. Reabra ou atualize a ficha antes de salvar.");
      const revalidar = async () => {
        const fresco = await tx.usuario.findUnique({ where: { id: autor.id }, select: { nome: true, papeis: true, permissoes: true, ativo: true } });
        if (!fresco?.ativo || (cadastroSolicitado&&apenasPortal({...fresco,id:autor.id}))) throw new ErroRegra("Sua sessão não está mais ativa.");
        Object.assign(autor, { nome: fresco.nome, papeis: fresco.papeis, permissoes: fresco.permissoes });
        const atual = await pessoaDoAtendimento(autor, id, tx);
        if (!atual || atual.pessoaId !== pessoa.pessoaId || atual.leadId !== pessoa.leadId) throw new ErroRegra("O contato mudou enquanto você editava. Recarregue o painel e tente de novo.");
        if (!capacidadesPainel(autor, { finalidade: "COMERCIAL", veLead: atual.leadId !== null }).editarContato) throw new ErroRegra("Você não tem acesso a esta função do CRM.");
        if(cadastroSolicitado){
          const crm=capacidadesCrm(autor.papeis);
          if(!crm.has("contatos.ver")||!crm.has("contatos.editar"))throw new ErroRegra("Você não tem acesso a esta função do CRM.");
          const permitida=await tx.pessoa.findFirst({where:{AND:[{id:pessoa.pessoaId,mescladaEmId:null},await escopoPessoas(autor,tx)]},select:{id:true}});
          if(!permitida)throw new ErroRegra("Contato não encontrado.");
          const bindingAtual=await lerBindingCadastro();
          if(!bindingAtual||bindingAtual.finalidade!=="COMERCIAL"||JSON.stringify(bindingAtual)!==JSON.stringify(bindingCadastro))throw new ErroRegra("O contato mudou. Recarregue o painel.");
          const ultimo=await tx.usuario.findUnique({where:{id:autor.id},select:{nome:true,papeis:true,permissoes:true,ativo:true}});
          if(!ultimo?.ativo||apenasPortal({...ultimo,id:autor.id})||JSON.stringify(ultimo.papeis)!==JSON.stringify(autor.papeis))throw new ErroRegra("Sua autorização mudou. Recarregue o painel.");
        }
      };
      await revalidar();
      const campos = await tx.campoPersonalizado.findMany({ where: { id: { in: ids } } });
      for (const valor of dados.campos ?? []) {
        const campo = campos.find(c => c.id === valor.campoId);
        if (!campo || campo.arquivadoEm || campo.alvo !== "PESSOA") throw new ErroRegra("Campo de pessoa indisponível.");
        const validado = validarValorCampo(campo, valor.valor);
        if (!validado.ok) throw new ErroRegra(validado.erro);
      }
      let mudou = await editarPessoaNaTransacao(tx, autor, pessoa.pessoaId, dados.pessoa ?? {}, revalidar);
      for (const valor of [...(dados.campos ?? [])].sort((a,b) => a.campoId.localeCompare(b.campoId))) {
        const alterado = await definirValorCampoNaTransacao(tx, autor, { campoId: valor.campoId, valor: valor.valor, pessoaId: pessoa.pessoaId }, revalidar);
        mudou = alterado || mudou;
      }
      if (mudou) await avisarAtendimento(tx, id);
      if(cadastroSolicitado)await revalidar();
    }).catch(e=>{if(cadastroSolicitado)erroSeguroCadastroPessoa(e);throw e;});
  });
}

export async function marcarPerdidoNoInbox(atendimentoId:string,input:PerdaInput,oportunidadeIdEsperada:string):Promise<Resultado>{
  return executarAcao(async()=>{
    const sessao=await exigirSessao(),id=Id.parse(atendimentoId),esperada=Id.parse(oportunidadeIdEsperada),dados=PerdaSchema.parse(input);
    await prisma.$transaction(tx=>comOportunidadeDoInboxTx(tx,sessao,id,esperada,async(autor,leadId)=>{
      const atual=await tx.oportunidade.findUniqueOrThrow({where:{id:leadId},select:{etapa:true}});
      const destino=destinoDoArraste(atual.etapa,"PERDIDO");
      if(destino.tipo==="recusar")throw new ErroRegra(destino.motivo);
      const mudou=await marcarPerdidoTx(tx,autor,leadId,dados);
      if(atual.etapa==="PERDIDO"&&mudou)throw new ErroRegra("Oportunidade encerrada não volta ao funil.");
      if(mudou)await avisarAtendimento(tx,id);
    }));
    revalidatePath("/funil");
  });
}

export async function moverEtapaNoInbox(atendimentoId: string, etapa: EtapaLead, oportunidadeIdEsperada: string): Promise<Resultado> {
  return executarAcao(async () => {
    const sessao = await exigirSessao(), id = Id.parse(atendimentoId), esperada = Id.parse(oportunidadeIdEsperada);
    const destino = z.nativeEnum(EtapaLead).parse(etapa);
    await prisma.$transaction(tx => comOportunidadeDoInboxTx(tx, sessao, id, esperada, async (autor, leadId) => {
      const antes = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true } });
      await moverEtapaTx(tx, autor, leadId, destino);
      if (antes.etapa !== destino) await avisarAtendimento(tx, id);
    }));
    revalidatePath("/funil");
  });
}
export async function concluirTarefaNoInbox(atendimentoId:string,tarefaId:string,versao:number,mensagemAgendada?:DecisaoMensagemAgendada):Promise<Resultado>{
 return executarAcao(async()=>{await executarTarefaInboxTx(await exigirSessao(),atendimentoId,tarefaId,versao,{tipo:"concluir",mensagemAgendada});revalidatePath("/tarefas");revalidatePath("/inicio");});
}
export async function reabrirTarefaNoInbox(atendimentoId:string,tarefaId:string,versao:number):Promise<Resultado>{
 return executarAcao(async()=>{await executarTarefaInboxTx(await exigirSessao(),atendimentoId,tarefaId,versao,{tipo:"reabrir"});revalidatePath("/tarefas");revalidatePath("/inicio");});
}
export async function reagendarTarefaNoInbox(atendimentoId:string,tarefaId:string,versao:number,q:ReagendamentoInbox):Promise<Resultado>{
 return executarAcao(async()=>{await executarTarefaInboxTx(await exigirSessao(),atendimentoId,tarefaId,versao,{tipo:"reagendar",q});revalidatePath("/tarefas");revalidatePath("/inicio");});
}
export async function cancelarTarefaNoInbox(atendimentoId:string,tarefaId:string,versao:number,motivo:string,mensagemAgendada?:DecisaoMensagemAgendada):Promise<Resultado>{
 return executarAcao(async()=>{await executarTarefaInboxTx(await exigirSessao(),atendimentoId,tarefaId,versao,{tipo:"cancelar",motivo,mensagemAgendada});revalidatePath("/tarefas");revalidatePath("/inicio");});
}
export async function dadosModalTarefaNoInbox(atendimentoId:string,tarefaId?:string):Promise<Resultado<DadosModalTarefa>>{
 return executarAcao(async()=>dadosTarefaModal(await exigirSessao(),atendimentoId,tarefaId));
}
export async function criarTarefaNoInbox(atendimentoId:string,input:CriarTarefaInboxInput):Promise<Resultado<{id:string}>>{
 return executarAcao(async()=>{const r=await criarTarefaInbox(await exigirSessao(),atendimentoId,input);revalidatePath("/tarefas");revalidatePath("/inicio");if(input.mensagem)revalidatePath("/inbox");return r;});
}
export async function editarTarefaNoInbox(atendimentoId:string,tarefaId:string,versao:number,input:EditarTarefaInboxInput):Promise<Resultado>{
 return executarAcao(async()=>{await editarTarefaInbox(await exigirSessao(),atendimentoId,tarefaId,versao,input);revalidatePath("/tarefas");revalidatePath("/inicio");});
}

export async function cancelarAgendadaNoInbox(atendimentoId:string,intencaoId:string):Promise<Resultado>{
 const r=await executarAcao(async()=>{const u=await exigirSessao();await cancelarAgendadaInboxTx(u,atendimentoId,intencaoId);});
 if(r.ok)revalidatePath("/inbox");
 return r;
}
export async function preverNotificadosTarefaNoInbox(atendimentoId:string,pedido:PedidoPreviaNotificadosTarefa):Promise<Resultado<PreviaNotificadosTarefa>>{
 return executarAcao(async()=>preverNotificadosTarefaInbox(await exigirSessao(),atendimentoId,pedido));
}

async function professorInformado(tx: Prisma.TransactionClient, professorId: string) {
  const professor = await tx.usuario.findUnique({ where: { id: professorId }, select: { papeis: true, ativo: true } });
  if (!professor || !professor.ativo) throw new ErroRegra("Professor não encontrado.");
  if (!professor.papeis.includes(Papel.PROFESSOR)) throw new ErroRegra("Usuário informado não é professor.");
}

function podeAgendarExperimental(etapa: EtapaLead) {
  return etapa === EtapaLead.EXPERIMENTAL_AGENDADA || destinoDoArraste(etapa, EtapaLead.EXPERIMENTAL_AGENDADA).tipo === "acao";
}

export async function agendarExperimentalNoInbox(atendimentoId: string, oportunidadeIdEsperada: string, input: AgendarExperimentalInput): Promise<Resultado> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const id = Id.parse(atendimentoId);
    const esperada = Id.parse(oportunidadeIdEsperada);
    const dados = AgendarExperimentalSchema.parse(input);
    const data = dados.dataLocal ? exigirInstanteDoCampoLocal(dados.dataLocal, dados.fuso) : new Date(dados.dataISO ?? "");
    if (Number.isNaN(data.getTime())) throw new ErroRegra("Data inválida.");
    const professorId = dados.professorId ?? null;
    await prisma.$transaction(async (tx) => {
      await comOportunidadeDoInboxTx(tx, sessao, id, esperada, async (autor, leadId) => {
        const antes = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true } });
        if (!podeAgendarExperimental(antes.etapa)) {
          const destino = destinoDoArraste(antes.etapa, EtapaLead.EXPERIMENTAL_AGENDADA);
          throw new ErroRegra(destino.tipo === "recusar" ? destino.motivo : "Não é possível agendar a experimental nesta etapa.");
        }
        if (professorId) await professorInformado(tx, professorId);
        const anterior = await professorAtribuido(tx, leadId);
        await tx.oportunidade.update({
          where: { id: leadId },
          data: {
            etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
            dataExperimental: data,
            professorExperimentalId: professorId,
            experimentalConfirmadaEm: null,
            aguardandoReagendamentoEm: null,
          },
        });
        await registrarEvento(tx, { tipo: "ExperimentalAgendada", agregadoTipo: "Lead", agregadoId: leadId, autorId: autor.id, payload: { data: data.toISOString() } });
        if (professorId !== anterior) {
          await registrarEvento(tx, { tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA, agregadoTipo: "Lead", agregadoId: leadId, autorId: autor.id, payload: { de: anterior, professorId } });
        }
        await avisarAtendimento(tx, id);
      });
    });
    revalidatePath("/funil");
    revalidatePath("/inbox");
    revalidatePath("/home");
  });
}

export async function atribuirProfessorExperimentalNoInbox(atendimentoId: string, oportunidadeIdEsperada: string, professorId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const id = Id.parse(atendimentoId);
    const esperada = Id.parse(oportunidadeIdEsperada);
    const professor = z.string().min(1, "Escolha o professor da experimental.").parse(professorId);
    await prisma.$transaction(async (tx) => {
      await comOportunidadeDoInboxTx(tx, sessao, id, esperada, async (autor, leadId) => {
        await professorInformado(tx, professor);
        const anterior = await professorAtribuido(tx, leadId);
        if (anterior === professor) return;
        await tx.oportunidade.update({ where: { id: leadId }, data: { professorExperimentalId: professor } });
        await registrarEvento(tx, { tipo: EVENTO_EXPERIMENTAL_ATRIBUIDA, agregadoTipo: "Lead", agregadoId: leadId, autorId: autor.id, payload: { de: anterior, professorId: professor } });
        await avisarAtendimento(tx, id);
      });
    });
    revalidatePath("/funil");
    revalidatePath("/inbox");
    revalidatePath("/home");
  });
}

export async function confirmarExperimentalNoInbox(atendimentoId: string, oportunidadeIdEsperada: string): Promise<Resultado> {
  return executarAcao(async () => {
    const sessao = await exigirSessao();
    const id = Id.parse(atendimentoId);
    const esperada = Id.parse(oportunidadeIdEsperada);
    await prisma.$transaction(async (tx) => {
      await comOportunidadeDoInboxTx(tx, sessao, id, esperada, async (autor, leadId) => {
        const antes = await tx.oportunidade.findUniqueOrThrow({ where: { id: leadId }, select: { etapa: true, dataExperimental: true, experimentalConfirmadaEm: true } });
        if (antes.etapa !== EtapaLead.EXPERIMENTAL_AGENDADA || !antes.dataExperimental) {
          throw new ErroRegra("Só é possível confirmar presença de uma aula experimental agendada.");
        }
        if (antes.experimentalConfirmadaEm) return;
        const agora = new Date();
        await tx.oportunidade.update({ where: { id: leadId }, data: { experimentalConfirmadaEm: agora } });
        await registrarEvento(tx, {
          tipo: "ExperimentalConfirmada",
          agregadoTipo: "Lead",
          agregadoId: leadId,
          autorId: autor.id,
          payload: { dataExperimental: antes.dataExperimental.toISOString(), confirmadaEm: agora.toISOString() },
        });
        await avisarAtendimento(tx, id);
      });
    });
    revalidatePath("/funil");
    revalidatePath("/inbox");
    revalidatePath("/home");
  });
}
