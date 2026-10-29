"use client";
import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { abrirAtendimentoInstitucional, type OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChavesPorAlvo } from "@/lib/chave-idempotencia";
import { Botao } from "@/components/Botao";
import { Combobox } from "@/components/ui/combobox";
import { garantirEstilo } from "@/app/(app)/inbox/garantir-estilo";
import { Avatar } from "@/components/Avatar";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { buscarNovaConversa, canaisDoDestino } from "./busca-nova-conversa";
import { Papel } from "@prisma/client";
import { NovaConversaPorNumero } from "./NovaConversaPorNumero";
import type { IntencaoNovaConversa } from "./intencao-nova-conversa";
const assinarVazio = () => () => {}; const lerVazio = () => false;
export function PopoverNovaConversa({ opcoes, itens, aoSelecionar, aoFechar, usuario, intencao }: { usuario?: {id:string;papeis:Papel[]}; intencao?: IntencaoNovaConversa; opcoes: OpcoesAtendimento; itens: ItemListaInbox[]; aoSelecionar(id: string): void; aoFechar(): void }) {
 garantirEstilo();
 const bloqueado = useSyncExternalStore(intencao?.assinar ?? assinarVazio, () => !!intencao?.ler().comando, lerVazio);
 const numeroPermitido = !!usuario?.papeis.some(p => p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL || p === Papel.ADMINISTRADOR);
 const [busca, setBusca] = useState(""); const [destino, setDestino] = useState(""); const [numero, setNumero] = useState("");
 const acao = useAcaoCliente({ idempotente: true }); const tentativas = useChavesPorAlvo(); const campoId = useId();
 const ocupada = useRef(false);
 const contexto = JSON.stringify(opcoes);
 const token = useMemo(() => Symbol(contexto), [contexto]);
 const atual = useRef<symbol | null>(null);
 useLayoutEffect(() => { atual.current = token; return () => { atual.current = null; }; }, [token]);
 const vigente = () => atual.current === token && !intencao?.ler().comando;
 const r = buscarNovaConversa(busca, itens, opcoes.destinos); const selecionado = opcoes.destinos.find(d => d.chave === destino);
 const canais = canaisDoDestino(selecionado, opcoes.numeros);
 async function abrir(chave: string, canalId: string) {
  const d = opcoes.destinos.find(d => d.chave === chave); if (!vigente() || ocupada.current || !d || d.disponivel === false || !canaisDoDestino(d, opcoes.numeros).some(n => n.id === canalId)) return;
  const tentativa = tentativas.para(JSON.stringify([chave, canalId]));
  ocupada.current = true;
  const resultado = await acao.executar(() => abrirAtendimentoInstitucional({ destinoChave: chave, numeroId: canalId, chaveIdempotencia: tentativa.atual }));
  ocupada.current = false; if (!vigente()) return;
  tentativa.depoisDo(resultado); if (resultado?.tipo === "ok") { aoSelecionar(resultado.dado!.id); aoFechar(); }
 }
 async function escolher(chave: string) {
  if (!vigente() || ocupada.current) return; const d = opcoes.destinos.find(d => d.chave === chave); if (!d || d.disponivel === false) return;
  setDestino(chave); setNumero(""); const ns = canaisDoDestino(d, opcoes.numeros); if (ns.length === 1) await abrir(chave, ns[0].id);
 }
 return <div className="space-y-3"><fieldset disabled={bloqueado} className="space-y-3 min-w-0">
  <label htmlFor={campoId} className="grid min-w-0 gap-1 text-sm">Nome ou número com DDD
   <input id={campoId} type="search" value={busca} onChange={e => { if (vigente() && !ocupada.current) { setBusca(e.target.value); setDestino(""); setNumero(""); } }} disabled={acao.ocupado} className="w-full rounded-md border border-gray-200 px-3 py-2" />
  </label>
  {r.conversas.map(c => <Botao key={c.id} variante="fantasma" tamanho="sm" disabled={acao.ocupado} onClick={() => { if (vigente() && !ocupada.current) { aoSelecionar(c.id); aoFechar(); } }}><Avatar nome={c.contatoNome} tamanho={32} /><span>{c.contatoNome}<span className="block text-xs text-gray-500">Conversa</span></span></Botao>)}
  {r.destinos.map(d => <div key={d.chave}><Botao variante="fantasma" tamanho="sm" disabled={acao.ocupado || d.disponivel === false} onClick={() => escolher(d.chave)}><Avatar nome={d.nome} tamanho={32} /><span>{d.nome}<span className="block text-xs text-gray-500">Contato</span></span></Botao>{d.impedimento && <p className="text-xs text-gray-600">{d.impedimento}</p>}</div>)}
  {selecionado && canais.length > 1 && <form onSubmit={e => { e.preventDefault(); if (numero) void abrir(selecionado.chave, numero); }} className="space-y-3">
   <label className="grid min-w-0 gap-1 text-sm">Canal da escola<Combobox aria-label="Canal da escola" required disabled={acao.ocupado} value={numero} onValueChange={valor => { if (vigente() && !ocupada.current) setNumero(valor); }} vazio="Selecione o canal" className="w-full rounded-md border border-gray-200 px-3 py-2" opcoes={canais.map(n => ({ valor: n.id, rotulo: n.nome }))} /></label>
   <Botao type="submit" disabled={acao.ocupado || !numero}>Abrir atendimento</Botao>
  </form>}
  {!opcoes.destinos.length ? <EstadoVazio>{opcoes.comercial ? (numeroPermitido ? "Nenhum contato já cadastrado na sua carteira. Use Conversar por telefone para conferir um número." : "Nenhum lead na sua carteira para iniciar uma conversa. Cadastre o lead em Leads; as conversas recebidas continuam na lista.") : "Nenhum destinatário no seu escopo para abrir um atendimento agora."}</EstadoVazio> : !opcoes.numeros.length ? <EstadoVazio>A administração precisa disponibilizar um canal ativo para os atendimentos autorizados.</EstadoVazio> : selecionado?.finalidade === "COMERCIAL" && !canais.length ? <EstadoVazio>Atendimento comercial sai pela sua linha comercial. Peça à administração para atribuir uma linha a você.</EstadoVazio> : r.numeroSemContato ? <EstadoVazio>{numeroPermitido ? "Use Conversar por telefone para conferir este número e o canal." : "Este número não está nos seus contatos. Cadastre o contato antes de iniciar a conversa."}</EstadoVazio> : !r.conversas.length && !r.destinos.length && <EstadoVazio>Nenhuma conversa ou contato encontrado.</EstadoVazio>}
  <FeedbackAcao erro={acao.erro} />
 </fieldset>
 {numeroPermitido && usuario && intencao && <NovaConversaPorNumero key={JSON.stringify(usuario)} usuario={usuario} intencao={intencao} aoSelecionar={aoSelecionar} aoFechar={aoFechar} />}
 </div>;
}
