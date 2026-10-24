"use client";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Drawer } from "@/components/Drawer";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ORIGEM_CANAL_LABEL } from "@/lib/labels";
import { editarContatoNoInbox } from "@/server/inbox/acoes-painel";
import type { CampoPainel, DetalhesPainel } from "@/server/inbox/painel-detalhes";
import type { ValorCampo } from "@/server/crm/campos";
import { diffContato, formDoContato, type FormContato } from "./form-contato";

export type PropsGavetaContato = {
  atendimentoId: string; dados: DetalhesPainel | null; erro?: boolean; podeVerFicha?: boolean;
  aoFechar(): void; aoSalvo(): void; aoRecarregar?(): void;
};
/** Cada abertura/atendimento é uma sessão; a ficha lida não muda sob a intenção em edição. */
export function GavetaContato(props: PropsGavetaContato) { return <EdicaoDoAtendimento key={props.atendimentoId} {...props} />; }
const CONTROLE = "min-h-11 w-full rounded border border-gray-300 bg-surface px-3 py-2 text-sm disabled:text-disabled";
function EdicaoDoAtendimento({ atendimentoId, dados, erro, podeVerFicha = false, aoFechar, aoSalvo, aoRecarregar }: PropsGavetaContato) {
  const [snapshot, setSnapshot] = useState(dados);
  const [form, setForm] = useState(() => dados ? formDoContato(dados) : null);
  if (!snapshot && dados) { setSnapshot(dados); setForm(formDoContato(dados)); }
  const acao = useAcaoCliente({ idempotente: true }), id = useId(), vivo = useRef(false);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const lido = snapshot ? formDoContato(snapshot) : null;
  const diff = lido && form ? diffContato(lido, form) : {};
  const mudou = Object.keys(diff).length > 0;
  function mudar<K extends keyof Omit<FormContato, "campos">>(campo: K, valor: FormContato[K]) {
    if (!acao.ocupado) setForm(f => f ? { ...f, [campo]: valor } : f);
  }
  function mudarCampo(campoId: string, valor: ValorCampo) {
    if (!acao.ocupado) setForm(f => f ? { ...f, campos: { ...f.campos, [campoId]: valor } } : f);
  }
  async function salvar(e: { preventDefault(): void }) {
    e.preventDefault(); if (!mudou || acao.ocupado || !snapshot?.pessoa) return;
    const resultado = await acao.executar(() => editarContatoNoInbox(atendimentoId, { pessoaIdEsperada: snapshot.pessoa!.id, ...diff }));
    if (resultado?.tipo === "ok" && vivo.current) { aoSalvo(); aoFechar(); }
  }
  function recarregarDetalhes(e: MouseEvent<HTMLButtonElement>) {
    // O Retry sai do DOM ao começar a aquisição; Fechar permanece disponível.
    e.currentTarget.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.focus();
    aoRecarregar?.();
  }
  const footer = form && snapshot?.pessoa ? <div className="flex justify-end gap-2">
    <Botao variante="fantasma" tamanho="md" onClick={aoFechar}>Cancelar</Botao>
    <Botao form={id} type="submit" variante="primario" tamanho="md" ocupado={acao.ocupado} disabled={!mudou}>Salvar</Botao>
  </div> : undefined;
  return <Drawer open onClose={aoFechar} title="Editar contato" largura="w-full max-w-none min-[700px]:w-[348px]" footer={footer}>
    {!snapshot ? erro ? <div role="alert" className="space-y-2 text-sm text-red-700"><p>Não foi possível carregar os detalhes.</p><Botao variante="secundario" tamanho="sm" disabled={!aoRecarregar} onClick={recarregarDetalhes}>Tentar de novo</Botao></div>
      : <p role="status" className="text-sm text-gray-600">Carregando os detalhes…</p>
      : !snapshot.pessoa || !form ? <p role="status" className="text-sm text-gray-600">Nenhuma pessoa disponível para edição neste atendimento.</p>
      : <form id={id} onSubmit={e => void salvar(e)} className="space-y-4">
        {([['nome', 'Nome', 200], ['email', 'E-mail', 200], ['cidade', 'Cidade', 120], ['cargo', 'Cargo', 120], ['linkedin', 'LinkedIn', 300]] as const).map(([nome, rotulo, maxLength]) => <Campo key={nome} rotulo={rotulo} obrigatorio={nome === "nome"}>{ligacao => <input {...ligacao} name={nome} value={form[nome]} maxLength={maxLength} type={nome === "email" ? "email" : "text"} disabled={acao.ocupado} onChange={e => mudar(nome, e.target.value)} className={CONTROLE} />}</Campo>)}
        <Campo rotulo="Origem do contato">{ligacao => <select {...ligacao} name="origemCanal" value={form.origemCanal} disabled={acao.ocupado} onChange={e => mudar("origemCanal", e.target.value as FormContato["origemCanal"])} className={CONTROLE}>
          <option value="">Sem origem</option>{Object.entries(ORIGEM_CANAL_LABEL).map(([valor,rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>}</Campo>
        {snapshot.campos.map(campo => <CampoPersonalizado key={campo.id} campo={campo} valor={form.campos[campo.id]} ocupado={acao.ocupado} aoMudar={valor => mudarCampo(campo.id, valor)} />)}
        {snapshot.pessoa.empresa && <section className="space-y-1 text-sm"><h3 className="font-medium">Empresa</h3><p>{snapshot.pessoa.empresa.nome}</p>{podeVerFicha && <a href={"/contatos?c=" + encodeURIComponent(snapshot.pessoa.id)} className="text-brand-700 underline">Trocar a empresa na ficha completa</a>}</section>}
        <FeedbackAcao erro={acao.erro} />
      </form>}
  </Drawer>;
}

function CampoPersonalizado({ campo, valor, ocupado, aoMudar }: { campo: CampoPainel; valor: ValorCampo; ocupado: boolean; aoMudar(valor: ValorCampo): void }) {
  if (campo.tipo === "BOOLEANO") return <Campo rotulo={campo.nome} obrigatorio={campo.obrigatorio}>{ligacao => <input {...ligacao} name={campo.id} type="checkbox" checked={valor === true} disabled={ocupado} onChange={e => aoMudar(e.target.checked)} className="h-5 w-5 accent-brand-700" />}</Campo>;
  if (campo.tipo === "SELECAO") return <Campo rotulo={campo.nome} obrigatorio={campo.obrigatorio}>{ligacao => <select {...ligacao} name={campo.id} value={String(valor ?? "")} disabled={ocupado} onChange={e => aoMudar(e.target.value || null)} className={CONTROLE}><option value="">Sem valor</option>{campo.opcoes.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}</select>}</Campo>;
  return <Campo rotulo={campo.nome} obrigatorio={campo.obrigatorio}>{ligacao => <input {...ligacao} name={campo.id} type={campo.tipo === "NUMERO" ? "number" : campo.tipo === "DATA" ? "date" : "text"} value={String(valor ?? "")} step={campo.tipo === "NUMERO" ? "any" : undefined} disabled={ocupado} onChange={e => aoMudar(e.target.value === "" ? null : campo.tipo === "NUMERO" ? Number(e.target.value) : e.target.value)} className={CONTROLE} />}</Campo>;
}
