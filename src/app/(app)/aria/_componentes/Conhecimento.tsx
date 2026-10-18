"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { CampoTexto } from "@/components/CampoTexto";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { STATUS_FONTE_CONHECIMENTO_LABEL } from "@/lib/labels";
import { arquivarFonte, criarFonteTexto } from "@/server/aria/conhecimento/fontes";
import type { ConfigAria } from "@/server/aria/config-schema";
import type { FonteTela } from "@/server/aria/tela";
import { CONTROLE, Interruptor } from "./Campos";
import { Salvar } from "./Salvar";

type Props = { config: ConfigAria; baseVersaoId: string | null; podeEditar: boolean; fontes: FonteTela[] };

export function Conhecimento({ config, baseVersaoId, podeEditar, fontes }: Props) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [c, setC] = useState<ConfigAria>(config);
  const [nova, setNova] = useState({ nome: "", texto: "", enviavel: false });
  const [pergunta, setPergunta] = useState({ pergunta: "", resposta: "" });
  const [arquivando, setArquivando] = useState<FonteTela | null>(null);
  const alterado = JSON.stringify(c) !== JSON.stringify(config);
  const ativas = new Set(c.fontesAtivas);
  const alternar = (id: string) => setC((x) => ({ ...x, fontesAtivas: ativas.has(id) ? x.fontesAtivas.filter((f) => f !== id) : [...x.fontesAtivas, id] }));

  async function criar() {
    const d = await acao.executar(() => criarFonteTexto({ nome: nova.nome, texto: nova.texto, enviavelAoLead: nova.enviavel }), "Fonte adicionada.");
    if (d?.tipo === "ok") {
      setNova({ nome: "", texto: "", enviavel: false });
      router.refresh();
    }
  }

  return (
    <section aria-labelledby="titulo-conhecimento" className="space-y-6">
      <div>
        <h2 id="titulo-conhecimento" className="text-lg font-semibold text-gray-900">Documentos e fontes</h2>
        <p className="mt-1 text-sm text-gray-600">{ativas.size} de {fontes.length} fontes ativas · {c.faq.filter((f) => f.ativa).length} perguntas e respostas ativas.</p>
        <Interruptor rotulo="Mostrar as fontes usadas nas notas internas" ligado={c.citarFontesNaNota} desabilitado={!podeEditar} aoMudar={(v) => setC((x) => ({ ...x, citarFontesNaNota: v }))} />
      </div>

      {fontes.length === 0 ? (
        <EstadoVazio bloco>Nenhuma fonte cadastrada. Adicione um texto abaixo para a Aria consultar.</EstadoVazio>
      ) : (
        <ul className="divide-y divide-border-soft rounded-lg border border-border-soft">
          {fontes.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">{f.nome}</p>
                <p className="text-gray-600">
                  {f.tipo === "TEXTO" ? "Texto" : "Arquivo"} · {STATUS_FONTE_CONHECIMENTO_LABEL[f.status]}
                  {f.enviavelAoLead ? " · pode ser enviado ao contato" : ""}
                  {f.desatualizada ? " · desatualizado" : ""}
                </p>
                {f.erro && <p className="text-red-700">{f.erro}</p>}
              </div>
              {podeEditar && (
                <div className="flex flex-wrap items-center gap-2">
                  <Interruptor rotulo={`Usar a fonte ${f.nome}`} ligado={ativas.has(f.id)} desabilitado={f.status !== "PRONTA"} aoMudar={() => alternar(f.id)} />
                  <Botao variante="fantasma" tamanho="sm" aria-label={`Arquivar a fonte ${f.nome}`} onClick={() => setArquivando(f)}>Arquivar</Botao>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <div className="grid grid-cols-1 gap-3 rounded-md border border-border-soft p-3">
          <h3 className="text-base font-semibold text-gray-900">Nova fonte de texto</h3>
          <Campo rotulo="Nome" obrigatorio>{(campo) => <input {...campo} className={CONTROLE} maxLength={120} value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} />}</Campo>
          <Campo rotulo="Texto" obrigatorio>{(campo) => <CampoTexto {...campo} className={CONTROLE} rows={6} value={nova.texto} onChange={(e) => setNova({ ...nova, texto: e.target.value })} />}</Campo>
          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={nova.enviavel} onChange={(e) => setNova({ ...nova, enviavel: e.target.checked })} />
            A Aria pode enviar este documento ao contato
          </label>
          <div><Botao ocupado={acao.ocupado} disabled={!nova.nome.trim() || !nova.texto.trim()} onClick={criar}>Adicionar fonte</Botao></div>
          <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
        </div>
      )}

      <div>
        <h3 className="text-base font-semibold text-gray-900">Perguntas e respostas</h3>
        <p className="mt-1 text-sm text-gray-600">Respostas exatas para perguntas frequentes. Têm prioridade sobre os documentos.</p>
        {c.faq.length === 0 ? (
          <EstadoVazio className="mt-2">Nenhuma pergunta cadastrada.</EstadoVazio>
        ) : (
          <ul className="mt-2 space-y-2">
            {c.faq.map((q) => (
              <li key={q.id} className="rounded-md border border-border-soft p-3 text-sm">
                <p className="font-medium text-gray-900">{q.pergunta}</p>
                <p className="mt-1 text-gray-700">{q.resposta}</p>
                {podeEditar && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Interruptor rotulo={`Usar a pergunta ${q.pergunta}`} ligado={q.ativa} aoMudar={(v) => setC((x) => ({ ...x, faq: x.faq.map((y) => (y.id === q.id ? { ...y, ativa: v } : y)) }))} />
                    <Botao variante="perigo" tamanho="sm" aria-label={`Remover a pergunta ${q.pergunta}`} onClick={() => setC((x) => ({ ...x, faq: x.faq.filter((y) => y.id !== q.id) }))}>Remover</Botao>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {podeEditar && c.faq.length < 100 && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-border-soft p-3">
            <Campo rotulo="Pergunta">{(campo) => <input {...campo} className={CONTROLE} maxLength={300} value={pergunta.pergunta} onChange={(e) => setPergunta({ ...pergunta, pergunta: e.target.value })} />}</Campo>
            <Campo rotulo="Resposta">{(campo) => <CampoTexto {...campo} className={CONTROLE} rows={3} maxLength={2000} value={pergunta.resposta} onChange={(e) => setPergunta({ ...pergunta, resposta: e.target.value })} />}</Campo>
            <div>
              <Botao
                variante="secundario"
                disabled={!pergunta.pergunta.trim() || !pergunta.resposta.trim()}
                onClick={() => {
                  setC((x) => ({ ...x, faq: [...x.faq, { id: crypto.randomUUID(), pergunta: pergunta.pergunta.trim(), resposta: pergunta.resposta.trim(), ativa: true }] }));
                  setPergunta({ pergunta: "", resposta: "" });
                }}
              >
                Adicionar pergunta
              </Botao>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-600">As mudanças em perguntas, respostas e fontes ativas entram na próxima publicação.</p>
      </div>

      {podeEditar && <Salvar montar={() => c} baseVersaoId={baseVersaoId} alterado={alterado} />}

      {arquivando && (
        <ConfirmarAcao
          titulo={`Arquivar a fonte ${arquivando.nome}?`}
          confirmacao={`o arquivamento de ${arquivando.nome}`}
          idempotente={false}
          acao={() => arquivarFonte(arquivando.id)}
          aoConcluir={() => { setArquivando(null); router.refresh(); }}
          aoCancelar={() => setArquivando(null)}
        >
          <p>A Aria deixa de consultar esta fonte. O arquivo fica guardado e não é apagado.</p>
        </ConfirmarAcao>
      )}
    </section>
  );
}
