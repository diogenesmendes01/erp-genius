"use client";

import { useState } from "react";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { EstadoVazio } from "@/components/EstadoVazio";
import { CampoTexto } from "@/components/CampoTexto";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { ACAO_AGENTE_IA_LABEL, ETAPA_LABEL } from "@/lib/labels";
import { ETAPAS_ARIA } from "@/server/aria/matriz";
import { testarAria, type ResultadoPlayground } from "@/server/aria/playground";
import { CONTROLE } from "./Campos";

type Props = { paises: { id: string; nome: string }[]; temRascunho: boolean; nome: string };
type Fala = { papel: "usuario" | "assistente"; texto: string };

const MOTIVO_HANDOFF: Record<string, string> = {
  PEDIDO_HUMANO: "Pediu para falar com uma pessoa",
  CONFIANCA: "Confiança baixa",
  PALAVRA_CHAVE: "Palavra-chave",
  HUMOR: "Contato irritado",
  ETAPA: "Etapa de transferência",
  VALOR: "Valor alto",
  FORA_POLITICA: "Fora da política",
  SEM_AVANCO: "Conversa sem avanço",
  RECUSA: "O modelo recusou responder",
  VALOR_NAO_AUTORIZADO: "Valor não autorizado",
  SEM_PRECO: "Sem preço disponível",
  SEM_PERMISSAO: "Sem permissão na matriz",
  ERRO_PROVEDOR: "Falha do provedor",
};

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

/** Conversa de teste com a Aria: nada é enviado nem alterado no CRM (só a chamada ao provedor é registrada). */
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
            <select {...campo} className={CONTROLE} value={etapa} onChange={(e) => setEtapa(e.target.value as typeof etapa)}>
              {ETAPAS_ARIA.map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="País dos preços">
          {(campo) => (
            <select {...campo} className={CONTROLE} value={paisId} onChange={(e) => setPaisId(e.target.value)}>
              <option value="">Primeiro país ativo</option>
              {paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
        </Campo>
        <Campo rotulo="Configuração testada">
          {(campo) => (
            <select {...campo} className={CONTROLE} value={usarRascunho ? "rascunho" : "publicada"} onChange={(e) => setUsarRascunho(e.target.value === "rascunho")}>
              <option value="publicada">Versão publicada</option>
              <option value="rascunho" disabled={!temRascunho}>Rascunho{temRascunho ? "" : " (não há)"}</option>
            </select>
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
          <p><strong>Transferiria para humano:</strong> {resultado.handoff ? `Sim, ${MOTIVO_HANDOFF[resultado.handoff] ?? resultado.handoff}` : "Não"}</p>
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
