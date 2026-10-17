"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Botao } from "@/components/Botao";
import { Campo } from "@/components/Campo";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { useAcaoCliente } from "@/lib/acao-cliente";
import { mesclarContatosDaLista } from "@/server/crm/contatos-acoes";
import type { ParDuplicado, PessoaMesclavel } from "@/server/crm/ficha-dados";

const CONTROLE = "w-full rounded-md border border-border-soft bg-surface-raised px-2 py-1.5 text-sm max-sm:min-h-11";
const CAMPOS = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "email", rotulo: "E-mail" },
  { chave: "cidade", rotulo: "Cidade" },
  { chave: "cargo", rotulo: "Cargo" },
] as const;

const MOTIVO: Record<string, string> = { telefone: "mesmo telefone", email: "mesmo e-mail", nome: "mesmo nome" };

type Lado = "a" | "b";

/** Resolve as escolhas relativas à pessoa principal: "principal" mantém o dado dela, "secundaria" o da outra. */
export function escolhasDaMescla(
  principal: Lado,
  escolhido: Record<(typeof CAMPOS)[number]["chave"], Lado>,
): Record<(typeof CAMPOS)[number]["chave"], "principal" | "secundaria"> {
  return Object.fromEntries(CAMPOS.map(({ chave }) => [chave, escolhido[chave] === principal ? "principal" : "secundaria"])) as never;
}

function Painel({ a, b, aoFechar, aoMesclar }: { a: PessoaMesclavel; b: PessoaMesclavel; aoFechar: () => void; aoMesclar: () => void }) {
  const router = useRouter();
  const [principal, setPrincipal] = useState<Lado>("a");
  const [escolhido, setEscolhido] = useState<Record<(typeof CAMPOS)[number]["chave"], Lado>>({ nome: "a", email: "a", cidade: "a", cargo: "a" });
  const [confirmando, setConfirmando] = useState(false);
  const pessoa = { a, b };
  const outra: Lado = principal === "a" ? "b" : "a";

  return (
    <section role="region" aria-label={`Mesclar ${a.nome} e ${b.nome}`} className="space-y-3 rounded-lg border border-border-soft bg-surface-raised p-3">
      <h3 className="text-sm font-medium">Mesclar {a.nome} e {b.nome}</h3>
      <Campo rotulo="Contato que permanece">
        {(campo) => (
          <select {...campo} className={CONTROLE} value={principal} onChange={(e) => setPrincipal(e.target.value as Lado)}>
            <option value="a">{a.nome}</option>
            <option value="b">{b.nome}</option>
          </select>
        )}
      </Campo>
      {CAMPOS.filter(({ chave }) => pessoa.a[chave] !== pessoa.b[chave]).map(({ chave, rotulo }) => (
        <Campo key={chave} rotulo={`${rotulo} que fica`}>
          {(campo) => (
            <select {...campo} className={CONTROLE} value={escolhido[chave]} onChange={(e) => setEscolhido((atual) => ({ ...atual, [chave]: e.target.value as Lado }))}>
              <option value="a">{pessoa.a[chave] ?? "Vazio"} (de {a.nome})</option>
              <option value="b">{pessoa.b[chave] ?? "Vazio"} (de {b.nome})</option>
            </select>
          )}
        </Campo>
      ))}
      <p className="text-sm text-gray-600">
        Telefones, oportunidades e histórico de {pessoa[outra].nome} passam para {pessoa[principal].nome}. O cadastro de {pessoa[outra].nome} fica arquivado e a mesclagem não é desfeita pela tela.
      </p>
      <div className="flex flex-wrap gap-2">
        <Botao tamanho="lg" onClick={() => setConfirmando(true)}>Revisar mesclagem</Botao>
        <Botao variante="fantasma" tamanho="lg" onClick={aoFechar}>Cancelar</Botao>
      </div>
      {confirmando && (
        <ConfirmarAcao
          titulo={`Mesclar ${pessoa[outra].nome} em ${pessoa[principal].nome}?`}
          confirmacao="mesclagem"
          idempotente={false}
          acao={() =>
            mesclarContatosDaLista({
              principalId: pessoa[principal].id,
              secundariaId: pessoa[outra].id,
              escolhas: escolhasDaMescla(principal, escolhido),
            })
          }
          aoConcluir={() => {
            setConfirmando(false);
            router.refresh();
            aoMesclar();
          }}
          aoCancelar={() => setConfirmando(false)}
        >
          <p>{pessoa[outra].nome} é arquivado e tudo dele passa para {pessoa[principal].nome}.</p>
          <p>Não há desfazer pela tela.</p>
        </ConfirmarAcao>
      )}
    </section>
  );
}

/** Duplicados sugeridos e, com duas pessoas marcadas na lista, a mesclagem delas. Só aparece para quem pode mesclar. */
export function MesclarContatos({ pares, selecionado }: { pares: ParDuplicado[]; selecionado: { a: PessoaMesclavel; b: PessoaMesclavel } | null }) {
  const [ativo, setAtivo] = useState<{ a: PessoaMesclavel; b: PessoaMesclavel } | null>(null);
  const acao = useAcaoCliente({ idempotente: false });
  if (pares.length === 0 && !selecionado && !ativo && !acao.sucesso) return null;
  return (
    <section aria-label="Duplicados" className="space-y-2">
      <FeedbackAcao erro={null} sucesso={acao.sucesso} />
      {selecionado && !ativo && (
        <Botao variante="secundario" tamanho="lg" onClick={() => setAtivo(selecionado)}>Mesclar selecionados</Botao>
      )}
      {pares.length > 0 && !ativo && (
        <>
          <h2 className="text-sm font-medium">Possíveis duplicados</h2>
          <ul className="space-y-1">
            {pares.map((p) => (
              <li key={`${p.a.id}:${p.b.id}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{p.a.nome} e {p.b.nome} <span className="text-gray-600">({p.motivos.map((m) => MOTIVO[m] ?? m).join(", ")})</span></span>
                <Botao variante="secundario" tamanho="md" aria-label={`Mesclar ${p.a.nome} e ${p.b.nome}`} onClick={() => setAtivo({ a: p.a, b: p.b })}>Mesclar</Botao>
              </li>
            ))}
          </ul>
        </>
      )}
      {ativo && <Painel a={ativo.a} b={ativo.b} aoFechar={() => setAtivo(null)} aoMesclar={() => { setAtivo(null); acao.setSucesso("Contatos mesclados."); }} />}
    </section>
  );
}
