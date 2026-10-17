"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Modal } from "@/components/Modal";
import { Campo } from "@/components/Campo";
import { FeedbackAcao } from "@/components/FeedbackAcao";

type Falha = { linha: number; motivo: string };
type Previa = { modo: "previa"; novos: number; existentes: number; validas: number; invalidas: Falha[]; repetidasNaPlanilha: number };
type Aplicada = { modo: "aplicar"; novos: number; atualizados: number; foraDaCarteira: number; invalidos: number; comOportunidade: number; repetidasNaPlanilha: number; erros: Falha[] };

const CONTROLE = "w-full rounded-md border border-border-soft bg-surface-raised px-2 py-1.5 text-sm max-sm:min-h-11";

/**
 * Importação de contatos por XLSX: primeiro a prévia (nada é gravado), depois "Importar". Nenhum consentimento
 * vem da planilha, e nenhuma mensagem é enviada. Só aparece com a capacidade `contatos.importar`.
 */
export function ImportarContatos({ vendedores }: { vendedores: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [resultado, setResultado] = useState<Aplicada | null>(null);
  const [comArquivo, setComArquivo] = useState(false);
  const [donoId, setDonoId] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);
  const arquivoId = useId();

  function fechar() {
    setAberto(false);
    setErro(null);
    setPrevia(null);
    setResultado(null);
    setComArquivo(false);
    setDonoId("");
  }

  async function enviar(modo: "previa" | "aplicar") {
    const file = arquivo.current?.files?.[0];
    if (!file) return setErro("Selecione um arquivo .xlsx.");
    setErro(null);
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      fd.append("modo", modo);
      if (donoId) fd.append("donoId", donoId);
      const r = await fetch("/api/contatos/importar", { method: "POST", body: fd });
      const dado = await r.json();
      if (!r.ok) setErro(dado?.erro ?? "Não foi possível importar os contatos.");
      else if (modo === "previa") setPrevia(dado as Previa);
      else {
        setResultado(dado as Aplicada);
        setPrevia(null);
        router.refresh();
      }
    } catch {
      setErro("Erro de rede. Confira a lista antes de tentar de novo.");
    }
    setEnviando(false);
  }

  return (
    <>
      <Botao variante="secundario" tamanho="lg" onClick={() => setAberto(true)}>Importar</Botao>
      {aberto && (
        <Modal titulo="Importar contatos" aoFechar={fechar} bloquearFechamento={enviando} larga>
          <p className="mb-3 text-sm text-gray-600">
            Envie uma planilha .xlsx com as colunas Nome, WhatsApp, E-mail, Cidade, Origem e Tag. Só Nome é obrigatória. A planilha não registra
            consentimento: ninguém recebe mensagem por causa da importação.
          </p>
          <div className="space-y-3">
            <Campo rotulo="Planilha de contatos" id={arquivoId}>
              {(campo) => (
                <input
                  {...campo}
                  ref={arquivo}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={enviando || !!resultado}
                  onChange={(e) => { setComArquivo(!!e.target.files?.length); setPrevia(null); }}
                  className="block w-full text-sm text-gray-600"
                />
              )}
            </Campo>
            {vendedores.length > 0 && (
              <Campo rotulo="Responsável pelas oportunidades novas" dica="Sem responsável, a importação só cadastra os contatos.">
                {(campo) => (
                  <select {...campo} className={CONTROLE} value={donoId} disabled={enviando || !!resultado} onChange={(e) => { setDonoId(e.target.value); setPrevia(null); }}>
                    <option value="">Nenhum</option>
                    {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
                  </select>
                )}
              </Campo>
            )}
          </div>

          <FeedbackAcao erro={erro} />

          {previa && (
            <div className="mt-3 rounded-md border border-border-soft p-3 text-sm">
              <p className="font-medium">{previa.novos} contato(s) novo(s) e {previa.existentes} já cadastrado(s).</p>
              {previa.repetidasNaPlanilha > 0 && <p>{previa.repetidasNaPlanilha} linha(s) repetida(s) na planilha contam uma vez.</p>}
              {previa.invalidas.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-auto text-xs text-gray-600">
                  {previa.invalidas.map((i) => <li key={i.linha}>Linha {i.linha}: {i.motivo}</li>)}
                </ul>
              )}
            </div>
          )}
          {resultado && (
            <>
              <p className="mt-3 rounded-md border border-border-soft p-3 text-sm font-medium" role="status">
                {resultado.novos} novo(s), {resultado.atualizados} atualizado(s), {resultado.foraDaCarteira > 0 && <>{resultado.foraDaCarteira} já cadastrado(s) fora da sua carteira (não alterados), </>}{resultado.comOportunidade} com oportunidade, {resultado.invalidos} com problema.
              </p>
              {resultado.erros.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-auto text-xs text-gray-600" aria-label="Linhas com problema">
                  {resultado.erros.map((i) => <li key={i.linha}>Linha {i.linha}: {i.motivo}</li>)}
                </ul>
              )}
            </>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Botao variante="fantasma" tamanho="lg" onClick={fechar} disabled={enviando}>{resultado ? "Fechar" : "Cancelar"}</Botao>
            {!resultado && !previa && (
              <Botao tamanho="lg" onClick={() => enviar("previa")} disabled={enviando || !comArquivo}>{enviando ? "Lendo…" : "Ver prévia"}</Botao>
            )}
            {!resultado && previa && (
              <Botao tamanho="lg" onClick={() => enviar("aplicar")} disabled={enviando || previa.validas === 0}>{enviando ? "Importando…" : `Importar ${previa.validas} linha(s)`}</Botao>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
