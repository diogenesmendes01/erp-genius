"use client";

import { useState, type FormEvent } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import { Campo, ROTULO_CAMPO } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import type { ConteudoEspecial } from "@/server/whatsapp/canal";

export type ConteudoEnquete = Extract<ConteudoEspecial, { tipo: "ENQUETE" }>;

export const MIN_OPCOES_ENQUETE = 2;
export const MAX_OPCOES_ENQUETE = 12;
export const MAX_PERGUNTA_ENQUETE = 255;
export const MAX_OPCAO_ENQUETE = 100;
const CLASSE_CONTROLE = "min-h-11 w-full rounded-md border border-gray-300 bg-surface px-3 py-2 text-sm";

export function validarEnquete(pergunta: string, opcoes: readonly string[], maxEscolhas: number): { ok: true; conteudo: ConteudoEnquete } | { ok: false; erro: string } {
  const nome = pergunta.trim();
  if (!nome) return { ok: false, erro: "Informe a pergunta da enquete." };
  if (nome.length > MAX_PERGUNTA_ENQUETE) return { ok: false, erro: `A pergunta pode ter no máximo ${MAX_PERGUNTA_ENQUETE} caracteres.` };
  const preenchidas = opcoes.map((o) => o.trim()).filter(Boolean);
  if (preenchidas.length < MIN_OPCOES_ENQUETE) return { ok: false, erro: "A enquete precisa de ao menos 2 opções." };
  if (preenchidas.length > MAX_OPCOES_ENQUETE) return { ok: false, erro: `A enquete pode ter no máximo ${MAX_OPCOES_ENQUETE} opções.` };
  if (preenchidas.some((o) => o.length > MAX_OPCAO_ENQUETE)) return { ok: false, erro: `Cada opção pode ter no máximo ${MAX_OPCAO_ENQUETE} caracteres.` };
  if (new Set(preenchidas.map((o) => o.toLocaleLowerCase("pt-BR"))).size !== preenchidas.length) return { ok: false, erro: "As opções precisam ser diferentes." };
  if (Number.isFinite(maxEscolhas) && !Number.isInteger(maxEscolhas)) return { ok: false, erro: "Escolhas por pessoa precisa ser um número inteiro." };
  if (!Number.isInteger(maxEscolhas) || maxEscolhas < 1) return { ok: false, erro: "Escolhas por pessoa: no mínimo 1." };
  if (maxEscolhas > preenchidas.length) return { ok: false, erro: "Escolhas por pessoa não pode passar do número de opções." };
  return { ok: true, conteudo: { tipo: "ENQUETE", nome, opcoes: preenchidas, maxEscolhas } };
}

export function FormEnquete({ aoEnviar, aoFechar }: { aoEnviar(c: ConteudoEnquete): Promise<Resultado<unknown>>; aoFechar(): void }) {
  const acao = useAcaoCliente({ idempotente: false });
  const [pergunta, setPergunta] = useState("");
  const [opcoes, setOpcoes] = useState<string[]>(() => ["", ""]);
  const [escolhas, setEscolhas] = useState("1");
  const preenchidas = opcoes.filter((o) => o.trim()).length;
  const pronta = !!pergunta.trim() && preenchidas >= MIN_OPCOES_ENQUETE;

  function mudarOpcao(i: number, v: string) {
    if (acao.ocupado) return;
    setOpcoes(opcoes.map((o, j) => (j === i ? v : o)));
    acao.setErro(null);
  }
  function adicionarOpcao() {
    if (acao.ocupado || opcoes.length >= MAX_OPCOES_ENQUETE) return;
    setOpcoes([...opcoes, ""]);
  }
  function removerOpcao(i: number) {
    if (acao.ocupado || opcoes.length <= MIN_OPCOES_ENQUETE) return;
    const novas = opcoes.filter((_, j) => j !== i);
    setOpcoes(novas);
    if (Number(escolhas) > novas.length) setEscolhas(String(novas.length));
  }
  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (acao.ocupado) return;
    const v = validarEnquete(pergunta, opcoes, Number(escolhas));
    if (!v.ok) { acao.setErro(v.erro); return; }
    const d = await acao.executar(() => aoEnviar(v.conteudo));
    if (d?.tipo === "ok") aoFechar();
  }

  return (
    <Modal folha titulo="Enviar enquete" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3" noValidate>
        <Campo id="enquete-pergunta" rotulo="Pergunta" obrigatorio>
          {(c) => <input {...c} className={CLASSE_CONTROLE} maxLength={MAX_PERGUNTA_ENQUETE} value={pergunta} disabled={acao.ocupado} onChange={(e) => { if (acao.ocupado) return; setPergunta(e.target.value); acao.setErro(null); }} />}
        </Campo>
        <fieldset className="space-y-2">
          <legend className={ROTULO_CAMPO}>Opções<span aria-hidden="true" className="text-red-700"> *</span></legend>
          {opcoes.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label={`Opção ${i + 1}`} aria-required="true" className={CLASSE_CONTROLE} maxLength={MAX_OPCAO_ENQUETE} value={o} disabled={acao.ocupado} onChange={(e) => mudarOpcao(i, e.target.value)} />
              {opcoes.length > MIN_OPCOES_ENQUETE && (
                <button type="button" aria-label={`Remover opção ${i + 1}`} disabled={acao.ocupado} onClick={() => removerOpcao(i)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-gray-600 hover:bg-highlight disabled:cursor-not-allowed disabled:opacity-50">
                  <IconTrash size={16} aria-hidden />
                </button>
              )}
            </div>
          ))}
          {opcoes.length < MAX_OPCOES_ENQUETE && (
            <Botao variante="fantasma" tamanho="sm" disabled={acao.ocupado} onClick={adicionarOpcao}><IconPlus size={14} aria-hidden />Adicionar opção</Botao>
          )}
        </fieldset>
        <Campo id="enquete-escolhas" rotulo="Escolhas por pessoa" dica={`De 1 a ${opcoes.length}.`}>
          {(c) => <input {...c} type="number" inputMode="numeric" min={1} max={opcoes.length} step={1} className={CLASSE_CONTROLE} value={escolhas} disabled={acao.ocupado}
            onChange={(e) => { if (acao.ocupado) return; setEscolhas(e.target.value); acao.setErro(null); }} />}
        </Campo>
        <FeedbackAcao erro={acao.erro} />
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" disabled={acao.ocupado} onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" ocupado={acao.ocupado} disabled={!pronta}>Enviar</Botao>
        </div>
      </form>
    </Modal>
  );
}
