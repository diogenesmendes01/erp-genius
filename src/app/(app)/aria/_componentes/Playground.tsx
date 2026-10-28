"use client";

import { useState } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { CampoTexto } from "@/components/CampoTexto";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL, MOTIVO_HANDOFF_LABEL } from "@/lib/labels";
import { ETAPAS_ARIA } from "@/server/aria/matriz";
import { testarAria } from "@/server/aria/acoes";
import type { ResultadoPlayground } from "@/server/aria/playground";
import { CONTROLE } from "./Campos";
import { CampoCombobox } from "@/components/ui/combobox";
import { CampoSelect } from "@/components/ui/select";

type Props = { paises: { id: string; nome: string }[]; temRascunho: boolean; nome: string };
type Fala = { papel: "usuario" | "assistente"; texto: string };



const DESTINO_ROTULO: Record<ResultadoPlayground["acoes"][number]["destino"], string> = {
  Executaria: "executaria",
  "Pediria aprovação": "pediria aprovação",
  "Sem permissão": "sem permissão",
};
const FONTE_ROTULO: Record<ResultadoPlayground["fontes"][number]["tipo"], string> = {
  FAQ: "Pergunta frequente",
  TRECHO: "Trecho da base de conhecimento",
  PRECO: "Preço de referência",
};

export function Playground({ paises, temRascunho, nome }: Props) {
  const acao = useAcaoCliente({ idempotente: false });
  const [historico, setHistorico] = useState<Fala[]>([]);
  const [texto, setTexto] = useState("");
  const [etapa, setEtapa] = useState<(typeof ETAPAS_ARIA)[number]>("NOVO");
  const [paisId, setPaisId] = useState("");
  const [usarRascunho, setUsarRascunho] = useState(temRascunho);
  const [resultado, setResultado] = useState<ResultadoPlayground | null>(null);

  async function enviar() {
    const fala = texto.trim();
    if (!fala) return;
    const mensagens: Fala[] = [...historico, { papel: "usuario", texto: fala }];
    const d = await acao.executar(() => testarAria({ mensagens, etapa, usarRascunho, paisId: paisId || undefined }));
    if (d?.tipo === "ok" && d.dado) {
      const r = d.dado;
      setResultado(r);
      setHistorico(r.resposta ? [...mensagens, { papel: "assistente", texto: r.resposta }] : mensagens);
      setTexto("");
    }
  }

  return (
    <section aria-label="Playground" className="space-y-4">
      <p className="inline-block rounded-md bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
        SIMULAÇÃO · nada é enviado nem alterado
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo rotulo="Etapa da oportunidade">
          {(campo) => (
            <CampoSelect id={campo.id} value={etapa} onValueChange={(v) => setEtapa(v as typeof etapa)} opcoes={ETAPAS_ARIA.map((e) => ({ valor: e, rotulo: ETAPA_LABEL[e] }))} />
          )}
        </Campo>
        <Campo rotulo="País dos preços">
          {(campo) => (
            <CampoCombobox id={campo.id} value={paisId} onValueChange={setPaisId} vazio="Primeiro país ativo" opcoes={paises.map((p) => ({ valor: p.id, rotulo: p.nome }))} />
          )}
        </Campo>
        <Campo rotulo="Configuração testada">
          {(campo) => (
            <CampoSelect id={campo.id} value={usarRascunho ? "rascunho" : "publicada"} onValueChange={(v) => setUsarRascunho(v === "rascunho")} opcoes={[{ valor: "publicada", rotulo: "Versão publicada" }, { valor: "rascunho", rotulo: `Rascunho${temRascunho ? "" : " (não há)"}`, disabled: !temRascunho }]} />
          )}
        </Campo>
      </div>

      <div aria-label="Conversa de teste" className="space-y-2 rounded-md border border-gray-200 p-3">
        {historico.length === 0 && <EstadoVazio>Escreva como se fosse o cliente. {nome} responde sem enviar nada.</EstadoVazio>}
        {historico.map((f, i) => (
          <p key={i} className={"max-w-[85%] rounded-md px-3 py-2 text-sm " + (f.papel === "usuario" ? "bg-surface-muted" : "ms-auto bg-brand-50")}>
            <span className="sr-only">{f.papel === "usuario" ? "Cliente: " : `${nome}: `}</span>
            {f.texto}
          </p>
        ))}
      </div>

      <Campo rotulo="Mensagem do cliente">
        {(campo) => <CampoTexto {...campo} className={CONTROLE} rows={2} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />}
      </Campo>
      <div className="flex flex-wrap gap-2">
        <Botao ocupado={acao.ocupado} disabled={!texto.trim()} onClick={enviar}>Testar</Botao>
        <Botao variante="secundario" disabled={acao.ocupado || historico.length === 0} onClick={() => { setHistorico([]); setResultado(null); acao.limpar(); }}>
          Limpar conversa
        </Botao>
      </div>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />

      {resultado && (
        <div aria-label="Resultado do teste" className="space-y-2 rounded-md border border-gray-200 p-3 text-sm">
          <p><strong>Confiança:</strong> {resultado.confianca}</p>
          <p><strong>Transferiria para humano:</strong> {resultado.handoff ? `Sim, ${Object.hasOwn(MOTIVO_HANDOFF_LABEL, resultado.handoff) ? MOTIVO_HANDOFF_LABEL[resultado.handoff] : "Motivo não informado"}` : "Não"}</p>
          {resultado.bloqueio && <p className="text-red-700"><strong>Bloqueio:</strong> {resultado.bloqueio}</p>}
          <div>
            <strong>Ações propostas</strong>
            {resultado.acoes.length === 0 ? (
              <EstadoVazio>Nenhuma.</EstadoVazio>
            ) : (
              <ul className="list-disc ps-5">
                {resultado.acoes.map((a, i) => <li key={i}>{ACAO_AGENTE_IA_LABEL[a.acao]}: {DESTINO_ROTULO[a.destino]}</li>)}
              </ul>
            )}
          </div>
          <div>
            <strong>Fontes usadas</strong>
            {resultado.fontes.length === 0 ? (
              <EstadoVazio>Nenhuma.</EstadoVazio>
            ) : (
              <ul className="list-disc ps-5">
                {resultado.fontes.map((f, i) => <li key={i}>{FONTE_ROTULO[f.tipo]}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
