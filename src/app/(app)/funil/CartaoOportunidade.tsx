"use client";

import { useDraggable } from "@dnd-kit/core";
import { IconGripVertical } from "@tabler/icons-react";
import { Avatar } from "@/components/Avatar";
import { TEMPERATURA_CLS, TEMPERATURA_LABEL } from "@/lib/labels";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import type { CartaoFunil } from "@/server/crm/funil";

export const FUSO_PADRAO = "America/Sao_Paulo";
export const INSTRUCOES_ARRASTE = "Pressione espaço para pegar; use as setas para trocar de coluna.";
export const ID_INSTRUCOES = "instrucoes-arraste-funil";

export type AcaoDoCartao = "agendarExperimental" | "marcarPerdido" | "prepararContratacao" | "enviarProposta";

const diaUtc = (civil: string) => {
  const [a, m, d] = civil.split("-").map(Number);
  return Date.UTC(a!, m! - 1, d!) / 86_400_000;
};

/** Dias civis (fuso institucional) entre `de` e `agora`; nunca negativo. */
export function diasCivis(de: Date, agora: Date, fuso: string): number {
  return Math.max(0, diaUtc(dataCivilInstitucional(agora, fuso)) - diaUtc(dataCivilInstitucional(de, fuso)));
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function textoDiasNaEtapa(etapaDesde: Date, agora: Date, fuso: string): string {
  const n = diasCivis(etapaDesde, agora, fuso);
  return n === 0 ? "Entrou hoje nesta etapa" : `Há ${plural(n, "dia", "dias")} nesta etapa`;
}

export function proximaAcaoDoCartao(c: Pick<CartaoFunil, "proximaAcao" | "proximoFollowUp">, agora: Date, fuso: string) {
  if (!c.proximoFollowUp) return c.proximaAcao ? { texto: c.proximaAcao, vencida: false } : null;
  const rotulo = c.proximaAcao || "Follow-up";
  const hoje = diaUtc(dataCivilInstitucional(agora, fuso));
  const dia = diaUtc(dataCivilInstitucional(c.proximoFollowUp, fuso));
  if (dia < hoje) return { texto: `${rotulo} · venceu há ${plural(hoje - dia, "dia", "dias")}`, vencida: true };
  if (dia === hoje) return { texto: `${rotulo} · hoje`, vencida: false };
  const [, m, d] = dataCivilInstitucional(c.proximoFollowUp, fuso).split("-");
  return { texto: `${rotulo} · ${d}/${m}`, vencida: false };
}

/** Valor com o código da moeda (nunca "R$" fixo), sempre com duas casas. */
export function valorComMoeda(valor: string | number, moeda: string): string {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "—";
  return `${moeda.trim().toUpperCase()} ${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
}

export function Temperatura({ temperatura }: { temperatura: CartaoFunil["temperatura"] }) {
  return (
    <span
      role="img"
      aria-label={`Temperatura: ${TEMPERATURA_LABEL[temperatura]}`}
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TEMPERATURA_CLS[temperatura]}`}
    >
      <span aria-hidden="true">{TEMPERATURA_LABEL[temperatura]}</span>
    </span>
  );
}

type Props = {
  cartao: CartaoFunil;
  podeMover: boolean;
  bloqueado?: boolean;
  agora: Date;
  fuso: string;
  aoAbrir: (id: string) => void;
};

function Corpo({ cartao, agora, fuso, aoAbrir, alca }: Omit<Props, "podeMover" | "bloqueado"> & { alca?: React.ReactNode }) {
  const proxima = proximaAcaoDoCartao(cartao, agora, fuso);
  return (
    <div className="flex items-start gap-1 rounded-item border border-border-soft bg-surface p-3">
      {alca}
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => aoAbrir(cartao.id)} className="block w-full text-left max-sm:min-h-11">
          <span className="block truncate font-medium">{cartao.nome}</span>
          <span className="block text-xs text-gray-600">{cartao.codigo ?? "Sem código"}</span>
        </button>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Temperatura temperatura={cartao.temperatura} />
          {cartao.b2b && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-gray-600">Empresa</span>}
          {cartao.valorPrevisto && cartao.moeda && <span className="text-xs text-gray-700">{valorComMoeda(cartao.valorPrevisto, cartao.moeda)}</span>}
        </div>
        <p className="mt-2 text-xs text-gray-600">{textoDiasNaEtapa(cartao.etapaDesde, agora, fuso)}</p>
        {proxima && <p className={"text-xs " + (proxima.vencida ? "text-red-700" : "text-gray-600")}>{proxima.texto}</p>}
        {cartao.dono && (
          <p className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <Avatar nome={cartao.dono.nome} tamanho={32} />
            <span className="truncate">{cartao.dono.nome}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function ComAlca(props: Props) {
  const { cartao, bloqueado } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: cartao.id,
    data: { etapa: cartao.etapa, nome: cartao.nome },
    disabled: bloqueado,
  });
  const alca = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      aria-roledescription="cartão arrastável"
      aria-describedby={ID_INSTRUCOES}
      aria-label={`Arrastar cartão de ${cartao.nome}`}
      className="flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-md text-gray-600 hover:bg-highlight"
    >
      <IconGripVertical aria-hidden="true" className="h-4 w-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} data-arrastando={isDragging ? "true" : undefined} className={isDragging ? "opacity-60" : undefined}>
      <Corpo {...props} alca={alca} />
    </div>
  );
}

export function CartaoOportunidade(props: Props) {
  return props.podeMover ? <ComAlca {...props} /> : <Corpo {...props} />;
}
