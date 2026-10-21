"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoriaDocumento, Segmento } from "@prisma/client";
import { Botao } from "@/components/Botao";
import { Campo, CONTROLE_INVALIDO } from "@/components/Campo";
import { CampoMoeda } from "@/components/CampoMoeda";
import { CampoTexto } from "@/components/CampoTexto";
import { EstadoVazio } from "@/components/EstadoVazio";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { UploadArquivo } from "@/components/UploadArquivo";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { useChaveIdempotencia } from "@/lib/chave-idempotencia";
import { formatarMoedaParaCampo } from "@/lib/dinheiro";
import { CATEGORIA_DOCUMENTO_LABEL, SEGMENTO_LABEL } from "@/lib/labels";
import {
  anexarDocumentoLead,
  arquivarDocumentoLead,
  atualizarDatas,
  atualizarResumo,
  editarLead,
  registrarInteracao,
} from "@/server/comercial/acoes";
import type { DetalheOportunidade } from "@/server/crm/historico";
import { FusoInstitucionalSchema, dataCivilInstitucional } from "@/server/operacao/fuso";

// Edições da oportunidade que moravam na ficha antiga (/leads/[id], removida no bloco J; B1 da R1 do #216):
// resumo e próximo passo, datas (follow-up, experimental, proposta), dados cadastrais, documentos e interação.
// As server actions são as mesmas da ficha (server/comercial/acoes.ts), com o mesmo papel e o mesmo escopo
// de carteira. registrarInteracao recebe chave de idempotência (#166): o reenvio da mesma tentativa não
// grava outra interação. Documentos são idempotentes por natureza (#166, lote 4): anexar o mesmo upload devolve
// o documento já anexado (a URL do upload é única) e arquivar o já arquivado não grava nada. As demais seguem
// sem chave: resultado incerto manda conferir antes de repetir.

const CONTROLE = `w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm max-sm:min-h-11 ${CONTROLE_INVALIDO}`;
const SECAO = "grid gap-3 border-b border-gray-200 pb-4";
const TITULO = "text-sm font-medium text-gray-900";

/** Estado da ação da seção; `concluiu` recarrega o painel só com a confirmação do servidor e diz se deu certo. */
function useAcaoSecao(idempotente = false) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente });
  function concluiu(desfecho: { tipo: string } | null | undefined): boolean {
    if (desfecho?.tipo !== "ok") return false;
    router.refresh();
    return true;
  }
  return { acao, concluiu };
}

function leitura(rotulo: string, valor: string | null) {
  return (
    <div key={rotulo} className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className="text-right text-gray-900">{valor || "Não informado"}</dd>
    </div>
  );
}

type CamposResumo = { interesse: string; objetivo: string; urgencia: string; orcamento: string; objecao: string; proximaAcao: string };
const CAMPOS_RESUMO: [keyof CamposResumo, string][] = [
  ["proximaAcao", "Próximo passo"],
  ["interesse", "Interesse"],
  ["objetivo", "Objetivo"],
  ["urgencia", "Urgência"],
  ["orcamento", "Orçamento"],
  ["objecao", "Objeção"],
];

const resumoDe = (op: DetalheOportunidade): CamposResumo => ({
  interesse: op.interesse ?? "",
  objetivo: op.objetivo ?? "",
  urgencia: op.urgencia ?? "",
  orcamento: op.orcamento ?? "",
  objecao: op.objecao ?? "",
  proximaAcao: op.proximaAcao ?? "",
});

/** Resumo comercial e próximo passo (o funil ordena e sinaliza pelo próximo passo). */
export function ResumoOportunidade({ oportunidade: op, podeEditar }: { oportunidade: DetalheOportunidade; podeEditar: boolean }) {
  const { acao, concluiu } = useAcaoSecao();
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState<CamposResumo>(resumoDe(op));

  return (
    <section aria-labelledby="op-resumo-titulo" className={SECAO}>
      <div className="flex items-center justify-between gap-2">
        <h3 id="op-resumo-titulo" className={TITULO}>Resumo e próximo passo</h3>
        {podeEditar && !editando && (
          <Botao variante="fantasma" tamanho="sm" onClick={() => { acao.limpar(); setF(resumoDe(op)); setEditando(true); }}>Editar resumo</Botao>
        )}
      </div>
      {editando ? (
        <div className="grid gap-3">
          {CAMPOS_RESUMO.map(([k, rotulo]) => (
            <Campo key={k} id={`op-resumo-${k}`} rotulo={rotulo}>
              {(c) => (
                <input {...c} type="text" maxLength={500} className={CONTROLE} value={f[k]} disabled={acao.ocupado} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              )}
            </Campo>
          ))}
          <FeedbackAcao erro={acao.erro} />
          <div className="flex flex-wrap gap-2">
            <Botao
              disabled={acao.ocupado}
              onClick={async () => {
                const enviado = f;
                if (concluiu(await acao.executar(() => atualizarResumo(op.id, enviado), "Resumo atualizado."))) setEditando(false);
              }}
            >Salvar resumo</Botao>
            <Botao variante="secundario" disabled={acao.ocupado} onClick={() => { acao.limpar(); setEditando(false); }}>Cancelar</Botao>
          </div>
        </div>
      ) : (
        <>
          <dl>
            {CAMPOS_RESUMO.map(([k, rotulo]) => leitura(rotulo, resumoDe(op)[k]))}
          </dl>
          <FeedbackAcao erro={null} sucesso={acao.sucesso} />
        </>
      )}
    </section>
  );
}

/**
 * "YYYY-MM-DD" da data civil no fuso institucional (as datas civis são gravadas ao meio-dia). Fuso inválido não
 * derruba o painel (C3 da review do #286): cai no dia UTC, como a exibição do follow-up.
 */
function dataCivil(d: Date | string | null, fuso: string): string {
  if (!d) return "";
  const x = new Date(d);
  if (!Number.isFinite(x.getTime())) return "";
  const valido = FusoInstitucionalSchema.safeParse(fuso);
  return valido.success ? dataCivilInstitucional(x, valido.data) : x.toISOString().slice(0, 10);
}

/** Valor de <input type="datetime-local"> na hora local do navegador (o mesmo do "Agendar experimental"). */
function dataHoraLocal(d: Date | string | null): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

type CamposDatas = { followUp: string; experimental: string; proposta: string };

/** Próximo follow-up e datas de experimental e proposta (alimentam a ordenação e os alertas do funil). */
export function DatasOportunidade({ oportunidade: op, podeEditar, fuso }: { oportunidade: DetalheOportunidade; podeEditar: boolean; fuso: string }) {
  const { acao, concluiu } = useAcaoSecao();
  const [f, setF] = useState<CamposDatas>({
    followUp: dataCivil(op.proximoFollowUp, fuso),
    experimental: dataHoraLocal(op.dataExperimental),
    proposta: dataCivil(op.dataProposta, fuso),
  });

  if (!podeEditar) return null;
  return (
    <section aria-labelledby="op-datas-titulo" className={SECAO}>
      <h3 id="op-datas-titulo" className={TITULO}>Datas e follow-up</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="op-datas-followup" rotulo="Próximo follow-up">
          {(c) => <input {...c} type="date" className={CONTROLE} value={f.followUp} disabled={acao.ocupado} onChange={(e) => setF({ ...f, followUp: e.target.value })} />}
        </Campo>
        <Campo id="op-datas-experimental" rotulo="Experimental (data e hora)">
          {(c) => <input {...c} type="datetime-local" className={CONTROLE} value={f.experimental} disabled={acao.ocupado} onChange={(e) => setF({ ...f, experimental: e.target.value })} />}
        </Campo>
        <Campo id="op-datas-proposta" rotulo="Data da proposta">
          {(c) => <input {...c} type="date" className={CONTROLE} value={f.proposta} disabled={acao.ocupado} onChange={(e) => setF({ ...f, proposta: e.target.value })} />}
        </Campo>
      </div>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      <div>
        <Botao
          variante="secundario"
          disabled={acao.ocupado}
          onClick={async () => {
            const enviados = f;
            const dados = {
              proximoFollowUp: enviados.followUp,
              dataExperimental: enviados.experimental ? new Date(enviados.experimental).toISOString() : "",
              dataProposta: enviados.proposta,
            };
            concluiu(await acao.executar(() => atualizarDatas(op.id, dados), "Datas atualizadas."));
          }}
        >Salvar datas</Botao>
      </div>
    </section>
  );
}

const paraCampoMoeda = (v: string | null) => (v == null || v === "" ? "" : formatarMoedaParaCampo(Number(v)));

type CamposDados = {
  nome: string; telefoneE164: string; paisId: string; segmento: Segmento; b2b: boolean;
  origemCampanha: string; origemAnuncio: string; valorPrevisto: string; planoPrevisto: string; comissaoPrevista: string;
};

const dadosDe = (op: DetalheOportunidade): CamposDados => ({
  nome: op.nome,
  telefoneE164: op.telefoneE164 ?? "",
  paisId: op.paisId ?? "",
  segmento: op.segmento,
  b2b: op.b2b,
  origemCampanha: op.origemCampanha ?? "",
  origemAnuncio: op.origemAnuncio ?? "",
  valorPrevisto: paraCampoMoeda(op.valorPrevisto),
  planoPrevisto: op.planoPrevisto ?? "",
  comissaoPrevista: paraCampoMoeda(op.comissaoPrevista),
});

/** Dados cadastrais da oportunidade (nome, contato, segmento, B2B, origem, valores previstos). */
export function DadosOportunidade({ oportunidade: op, podeEditar, paises }: { oportunidade: DetalheOportunidade; podeEditar: boolean; paises: { id: string; nome: string }[] }) {
  const { acao, concluiu } = useAcaoSecao();
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState<CamposDados>(dadosDe(op));
  const [erroNome, setErroNome] = useState<string | null>(null);

  if (!podeEditar) return null;
  if (!editando) {
    return (
      <div className="grid gap-2">
        <FeedbackAcao erro={null} sucesso={acao.sucesso} />
        <div>
          <Botao variante="secundario" onClick={() => { acao.limpar(); setErroNome(null); setF(dadosDe(op)); setEditando(true); }}>Editar dados</Botao>
        </div>
      </div>
    );
  }
  const texto = (k: "nome" | "telefoneE164" | "origemCampanha" | "origemAnuncio" | "planoPrevisto", rotulo: string, tipo = "text") => (
    <Campo id={`op-dados-${k}`} rotulo={rotulo} obrigatorio={k === "nome"} erro={k === "nome" ? erroNome : null}>
      {(c) => <input {...c} type={tipo} className={CONTROLE} value={f[k]} disabled={acao.ocupado} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </Campo>
  );
  return (
    <section aria-labelledby="op-dados-titulo" className={SECAO}>
      <h3 id="op-dados-titulo" className={TITULO}>Editar dados da oportunidade</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {texto("nome", "Nome")}
        {texto("telefoneE164", "WhatsApp", "tel")}
        <Campo id="op-dados-paisId" rotulo="País">
          {(c) => (
            <select {...c} className={CONTROLE} value={f.paisId} disabled={acao.ocupado} onChange={(e) => setF({ ...f, paisId: e.target.value })}>
              {[<option key="" value="">Não informado</option>, ...paises.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)]}
            </select>
          )}
        </Campo>
        <Campo id="op-dados-segmento" rotulo="Segmento">
          {(c) => (
            <select {...c} className={CONTROLE} value={f.segmento} disabled={acao.ocupado} onChange={(e) => setF({ ...f, segmento: e.target.value as Segmento })}>
              {Object.values(Segmento).map((s) => <option key={s} value={s}>{SEGMENTO_LABEL[s]}</option>)}
            </select>
          )}
        </Campo>
        {texto("origemCampanha", "Campanha (origem)")}
        {texto("origemAnuncio", "Anúncio (origem)")}
        <Campo id="op-dados-valorPrevisto" rotulo="Valor previsto">
          {(c) => <CampoMoeda {...c} moeda={op.moeda ?? undefined} className={CONTROLE} value={f.valorPrevisto} disabled={acao.ocupado} onChange={(v) => setF({ ...f, valorPrevisto: v })} />}
        </Campo>
        {texto("planoPrevisto", "Plano previsto")}
        <Campo id="op-dados-comissaoPrevista" rotulo="Comissão prevista">
          {(c) => <CampoMoeda {...c} moeda={op.moeda ?? undefined} className={CONTROLE} value={f.comissaoPrevista} disabled={acao.ocupado} onChange={(v) => setF({ ...f, comissaoPrevista: v })} />}
        </Campo>
        <Campo id="op-dados-b2b" rotulo="Oportunidade corporativa (B2B)">
          {(c) => (
            <select {...c} className={CONTROLE} value={f.b2b ? "true" : "false"} disabled={acao.ocupado} onChange={(e) => setF({ ...f, b2b: e.target.value === "true" })}>
              <option value="false">Não</option>
              <option value="true">Sim</option>
            </select>
          )}
        </Campo>
      </div>
      <FeedbackAcao erro={acao.erro} />
      <div className="flex flex-wrap gap-2">
        <Botao
          disabled={acao.ocupado}
          onClick={async () => {
            if (!f.nome.trim()) { setErroNome("Informe o nome"); return; }
            setErroNome(null);
            const enviado = f;
            const ok = concluiu(await acao.executar(() => editarLead(op.id, {
                ...enviado,
                nome: enviado.nome.trim(),
                // editarLead grava o formulário inteiro: temperatura e a origem que esta tela não mostra vão como estão.
                temperatura: op.temperatura,
                origemConjunto: op.origemConjunto ?? "",
                origemPalavra: op.origemPalavra ?? "",
              }), "Dados atualizados."));
            if (ok) setEditando(false);
          }}
        >Salvar dados</Botao>
        <Botao variante="secundario" disabled={acao.ocupado} onClick={() => { acao.limpar(); setEditando(false); }}>Cancelar</Botao>
      </div>
    </section>
  );
}

/** Documentos da oportunidade: anexar (upload ligado à oportunidade e à categoria) e arquivar. */
export function DocumentosOportunidade({ oportunidade: op, podeEditar }: { oportunidade: DetalheOportunidade; podeEditar: boolean }) {
  // Idempotente por natureza (#166): o mesmo upload não vira segundo documento; arquivar duas vezes não grava de novo.
  const { acao, concluiu } = useAcaoSecao(true);
  const [categoria, setCategoria] = useState<CategoriaDocumento>(CategoriaDocumento.PROPOSTA);

  return (
    <section aria-labelledby="op-documentos-titulo" className={SECAO}>
      <h3 id="op-documentos-titulo" className={TITULO}>Documentos</h3>
      {podeEditar && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo id="op-documento-categoria" rotulo="Categoria do documento">
            {(c) => (
              <select {...c} className={CONTROLE} value={categoria} disabled={acao.ocupado} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento)}>
                {Object.values(CategoriaDocumento).map((k) => <option key={k} value={k}>{CATEGORIA_DOCUMENTO_LABEL[k]}</option>)}
              </select>
            )}
          </Campo>
          <UploadArquivo
            key={categoria}
            label="Anexar documento"
            leadId={op.id}
            categoriaDocumento={categoria}
            onUpload={async (r) => concluiu(await acao.executar(() => anexarDocumentoLead(op.id, { categoria, nome: r.nome, url: r.url }), "Documento anexado."))}
          />
        </div>
      )}
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      {op.documentos.length === 0 ? (
        <EstadoVazio>Nenhum documento anexado.</EstadoVazio>
      ) : (
        <ul className="grid gap-1 text-sm">
          {op.documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 border-b border-gray-200 py-1">
              <a href={d.url} target="_blank" rel="noreferrer" className="text-brand-700 underline">
                {CATEGORIA_DOCUMENTO_LABEL[d.categoria]}: {d.nome}
              </a>
              {podeEditar && (
                <Botao variante="fantasma" tamanho="sm" disabled={acao.ocupado} onClick={async () => concluiu(await acao.executar(() => arquivarDocumentoLead(d.id), "Documento arquivado."))}>
                  Arquivar<span className="sr-only"> {d.nome}</span>
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Registro de interação com o contato (canal e o que aconteceu); entra no histórico da oportunidade. */
export function InteracaoOportunidade({ oportunidadeId }: { oportunidadeId: string }) {
  // Com chave de idempotência (#166), fora do `useAcaoSecao`: o reenvio depois de um resultado incerto devolve a
  // interação já registrada, e a mensagem do incerto manda reenviar.
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: true });
  const tentativa = useChaveIdempotencia();
  const [canal, setCanal] = useState("");
  const [nota, setNota] = useState("");

  return (
    <section aria-labelledby="op-interacao-titulo" className="grid gap-2">
      <h3 id="op-interacao-titulo" className={TITULO}>Interação com o contato</h3>
      <Campo id="op-interacao-canal" rotulo="Canal" dica="WhatsApp, ligação, e-mail, presencial…">
        {(c) => <input {...c} type="text" maxLength={60} className={CONTROLE} value={canal} disabled={acao.ocupado} onChange={(e) => setCanal(e.target.value)} />}
      </Campo>
      <Campo id="op-interacao-nota" rotulo="O que aconteceu">
        {(c) => <CampoTexto {...c} rows={3} maxLength={2000} className={CONTROLE} value={nota} disabled={acao.ocupado} onChange={(e) => setNota(e.target.value)} />}
      </Campo>
      <FeedbackAcao erro={acao.erro} sucesso={acao.sucesso} />
      <div>
        <Botao
          variante="secundario"
          disabled={!nota.trim() || acao.ocupado}
          onClick={async () => {
            // Canal e nota só são limpos com a interação confirmada: na falha, o texto fica para conferir.
            const d = await acao.executar(() => registrarInteracao(oportunidadeId, { canal, nota, chaveIdempotencia: tentativa.atual }), "Interação registrada.");
            tentativa.depoisDo(d);
            if (d?.tipo === "ok") {
              router.refresh();
              setCanal("");
              setNota("");
            }
          }}
        >Registrar interação</Botao>
      </div>
    </section>
  );
}
