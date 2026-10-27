"use client";

import { useState, type FormEvent } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { Modal } from "@/components/Modal";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import type { ConteudoEspecial } from "@/server/whatsapp/canal";
import { lerCoordenadas } from "./coordenadas";

export type ConteudoLocalizacao = Extract<ConteudoEspecial, { tipo: "LOCALIZACAO" }>;

export const MAX_NOME_LOCAL = 255;
export const DICA_COORDENADAS = "Cole o link do Google Maps ou digite latitude, longitude.";
export const ERRO_COORDENADAS = "Não foi possível ler a localização. Cole o link do Google Maps ou digite latitude, longitude.";
const CLASSE_CONTROLE = "min-h-11 w-full rounded-md border border-gray-300 bg-surface px-3 py-2 text-sm";

export function validarLocalizacao(nome: string, local: string): { ok: true; conteudo: ConteudoLocalizacao } | { ok: false; erro: string } {
  if (!local.trim()) return { ok: false, erro: "Informe o link do mapa ou as coordenadas." };
  const coordenadas = lerCoordenadas(local);
  if (!coordenadas) return { ok: false, erro: ERRO_COORDENADAS };
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length > MAX_NOME_LOCAL) return { ok: false, erro: `O nome do local pode ter no máximo ${MAX_NOME_LOCAL} caracteres.` };
  return { ok: true, conteudo: { tipo: "LOCALIZACAO", ...coordenadas, ...(nomeLimpo ? { nome: nomeLimpo } : {}) } };
}

export function FormLocalizacao({ aoEnviar, aoFechar }: { aoEnviar(c: ConteudoLocalizacao): Promise<Resultado<unknown>>; aoFechar(): void }) {
  const acao = useAcaoCliente({ idempotente: false });
  const [nome, setNome] = useState("");
  const [local, setLocal] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (acao.ocupado) return;
    const v = validarLocalizacao(nome, local);
    if (!v.ok) { setErroLocal(v.erro); return; }
    setErroLocal(null);
    const d = await acao.executar(() => aoEnviar(v.conteudo));
    if (d?.tipo === "ok") aoFechar();
  }

  return (
    <Modal folha titulo="Enviar localização" aoFechar={aoFechar} bloquearFechamento={acao.ocupado}>
      <form onSubmit={(e) => void enviar(e)} className="space-y-3" noValidate>
        <Campo id="localizacao-nome" rotulo="Nome do local">
          {(c) => <input {...c} className={CLASSE_CONTROLE} maxLength={MAX_NOME_LOCAL} value={nome} disabled={acao.ocupado} onChange={(e) => { if (!acao.ocupado) setNome(e.target.value); }} />}
        </Campo>
        <Campo id="localizacao-link" rotulo="Link do mapa ou coordenadas" obrigatorio dica={DICA_COORDENADAS} erro={erroLocal}>
          {(c) => <input {...c} className={CLASSE_CONTROLE} value={local} disabled={acao.ocupado} onChange={(e) => { if (acao.ocupado) return; setLocal(e.target.value); setErroLocal(null); }} />}
        </Campo>
        <FeedbackAcao erro={acao.erro} />
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="secundario" disabled={acao.ocupado} onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" ocupado={acao.ocupado} disabled={!local.trim()}>Enviar</Botao>
        </div>
      </form>
    </Modal>
  );
}
