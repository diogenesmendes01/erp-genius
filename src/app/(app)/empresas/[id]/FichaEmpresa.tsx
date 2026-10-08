"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColaboradorRelatorio, FaturaResumo } from "@/server/empresas/consultas";
import {
  cancelarFaturaB2B,
  pagarFaturaB2B,
  salvarEmpresa,
} from "@/server/empresas/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_MATRICULA_LABEL, rotular, STATUS_FATURA_B2B_LABEL } from "@/lib/labels";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { formatarCompetencia } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";

// FICHA DA EMPRESA: responsável financeiro, colaboradores e faturas históricas.
// A matrícula é preparada individualmente; lote corporativo não está disponível.

const btnPri = botaoClasses();

interface EmpresaFicha {
  id: string;
  codigo: string | null;
  nome: string;
  paisId: string | null;
  documento: string | null;
  contatoNome: string | null;
  contatoEmail: string | null;
  contatoTelefone: string | null;
  diaVencimento: number;
  observacoes: string | null;
  ativo: boolean;
}

/** Identificação da fatura na confirmação: código, competência, cobranças e total. */
function ResumoFatura({ fatura }: { fatura: FaturaResumo }) {
  return (
    <p>
      <strong>{fatura.codigo ?? "Fatura sem código"}</strong> · {formatarCompetencia(fatura.competencia)} · {fatura.cobrancas} {fatura.cobrancas === 1 ? "cobrança" : "cobranças"} · total <strong>{formatarMoeda(fatura.valorTotal, fatura.moeda)}</strong>
    </p>
  );
}

export function FichaEmpresa({
  empresa,
  colaboradores,
  faturas,
  podePagar,
}: {
  empresa: EmpresaFicha;
  colaboradores: ColaboradorRelatorio[];
  faturas: FaturaResumo[];
  produtos: { id: string; label: string }[];
  competencias: string[];
  podePagar: boolean;
}) {
  const router = useRouter();
  // Antes, uma falha de rede deixava `ocupado` preso em true e travava a ficha inteira. Nenhuma das
  // três ações tem chave de idempotência: resultado incerto manda conferir antes de repetir.
  const acao = useAcaoCliente({ idempotente: false });
  // O resultado aparece na seção do botão que o disparou (faturas ou contrato), não no topo.
  const [origem, setOrigem] = useState<"faturas" | "contrato" | null>(null);
  const ocupado = acao.ocupado;

  async function run<T>(secao: "faturas" | "contrato", disparar: () => Promise<Resultado<T>>, sucesso: string) {
    setOrigem(secao);
    if ((await acao.executar(disparar, sucesso))?.tipo === "ok") router.refresh();
  }
  // Pagar baixa EM LOTE todas as cobranças da fatura; cancelar desfaz o agrupamento. Nenhum dos dois tem
  // desfazer pela tela (docs/42 L2281): o botão da linha só abre a confirmação, que repete fatura,
  // competência, quantidade de cobranças e total. A action roda no ConfirmarAcao.
  const [confirmarFatura, setConfirmarFatura] = useState<{ fatura: FaturaResumo; operacao: "pagar" | "cancelar" } | null>(null);
  function pedirConfirmacao(fatura: FaturaResumo, operacao: "pagar" | "cancelar") {
    setOrigem("faturas");
    acao.limpar();
    setConfirmarFatura({ fatura, operacao });
  }
  function faturaConcluida(mensagem: string) {
    setConfirmarFatura(null);
    setOrigem("faturas");
    acao.setSucesso(mensagem);
    router.refresh();
  }
  const feedback = (secao: "faturas" | "contrato") => (
    <FeedbackAcao erro={origem === secao ? acao.erro : null} sucesso={origem === secao ? acao.sucesso : null} className="mt-3" />
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{empresa.nome}</h1>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">B2B</span>
          {!empresa.ativo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inativa</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {empresa.codigo ?? "—"} · vencimento dia {empresa.diaVencimento}
          {empresa.contatoNome ? ` · contato: ${empresa.contatoNome}` : ""}
          {empresa.contatoEmail ? ` (${empresa.contatoEmail})` : ""}
        </p>
      </header>

      {/* Histórico de contratos individuais vinculados ao responsável financeiro. */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Colaboradores ({colaboradores.length})</h2>
          <Link className={btnPri} href="/matriculas/nova">Preparar matrícula individual</Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">A empresa pode ser o responsável financeiro, mas cada colaborador é preparado e contratado individualmente.</p>

        {colaboradores.length === 0 ? (
          <EstadoVazio>Nenhum contrato individual vinculado a esta empresa ainda.</EstadoVazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Colaborador</th>
                  <th className="px-3 py-2 font-medium">Matrícula</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Pagas</th>
                  <th className="px-3 py-2 font-medium">Abertas</th>
                  <th className="px-3 py-2 font-medium">Atrasadas</th>
                  <th className="px-3 py-2 font-medium">Total pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {colaboradores.map((c) => (
                  <tr key={c.matriculaId}>
                    <td className="px-3 py-2">
                      <Link href={`/alunos/${c.alunoId}`} className="font-medium text-gray-800 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{c.codigo ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{rotular(STATUS_MATRICULA_LABEL, c.statusMatricula)}</td>
                    <td className="px-3 py-2 text-gray-700">{c.mensalidadesPagas}</td>
                    <td className="px-3 py-2 text-gray-700">{c.mensalidadesAbertas}</td>
                    <td className={"px-3 py-2 " + (c.mensalidadesAtrasadas > 0 ? "font-medium text-red-600" : "text-gray-700")}>
                      {c.mensalidadesAtrasadas}
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {formatarMoeda(c.totalPago, c.moeda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Faturas corporativas já registradas permanecem consultáveis e editáveis. */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Faturas históricas</h2>

        {faturas.length === 0 ? (
          <EstadoVazio>
            Nenhuma fatura histórica vinculada a esta empresa.
          </EstadoVazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Fatura</th>
                  <th className="px-3 py-2 font-medium">Competência</th>
                  <th className="px-3 py-2 font-medium">Cobranças</th>
                  <th className="px-3 py-2 font-medium">Total</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {faturas.map((f) => (
                  <tr key={f.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{f.codigo ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{formatarCompetencia(f.competencia)}</td>
                    <td className="px-3 py-2 text-gray-600">{f.cobrancas}</td>
                    <td className="px-3 py-2 text-gray-800">
                      {formatarMoeda(f.valorTotal, f.moeda)}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{new Date(f.vencimento).toLocaleDateString("pt-BR")}</td>
                    <td className="px-3 py-2 text-gray-600">{rotular(STATUS_FATURA_B2B_LABEL, f.status)}</td>
                    <td className="px-3 py-2">
                      {f.status === "FECHADA" && (
                        // "Cancelar" sozinho, ao lado da ação primária, lia-se como "desistir da operação":
                        // o botão diz o que cancela e fica afastado do pagamento.
                        <span className="flex flex-wrap gap-3">
                          {podePagar && (
                            <button
                              className={btnPri}
                              disabled={ocupado}
                              onClick={() => pedirConfirmacao(f, "pagar")}
                            >
                              Registrar pagamento
                            </button>
                          )}
                          <button
                            className={botaoClasses({ variante: "perigo" })}
                            disabled={ocupado}
                            onClick={() => pedirConfirmacao(f, "cancelar")}
                          >
                            Cancelar fatura
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {feedback("faturas")}
        {confirmarFatura?.operacao === "pagar" && (
          <ConfirmarAcao
            titulo={`Registrar o pagamento da fatura ${confirmarFatura.fatura.codigo ?? "sem código"}?`}
            confirmacao="pagamento da fatura"
            idempotente={false}
            acao={() => pagarFaturaB2B(confirmarFatura.fatura.id)}
            aoConcluir={(d: { baixadas: number } | undefined) => {
              const baixadas = d?.baixadas ?? confirmarFatura.fatura.cobrancas;
              faturaConcluida(baixadas === 1 ? "Fatura paga — 1 cobrança baixada." : `Fatura paga — ${baixadas} cobranças baixadas em lote.`);
            }}
            aoCancelar={() => setConfirmarFatura(null)}
          >
            <ResumoFatura fatura={confirmarFatura.fatura} />
            <p>
              {confirmarFatura.fatura.cobrancas === 1 ? "A cobrança da fatura é baixada" : `As ${confirmarFatura.fatura.cobrancas} cobranças da fatura são baixadas em lote`}, cada uma pelo valor faturado, e a fatura passa a paga. Não há desfazer pela tela.
            </p>
          </ConfirmarAcao>
        )}
        {confirmarFatura?.operacao === "cancelar" && (
          <ConfirmarAcao
            titulo={`Cancelar a fatura ${confirmarFatura.fatura.codigo ?? "sem código"}?`}
            confirmacao="cancelamento da fatura"
            idempotente={false}
            acao={() => cancelarFaturaB2B(confirmarFatura.fatura.id)}
            aoConcluir={() => faturaConcluida("Fatura cancelada — as cobranças voltaram a ficar soltas.")}
            aoCancelar={() => setConfirmarFatura(null)}
          >
            <ResumoFatura fatura={confirmarFatura.fatura} />
            <p>
              A fatura passa a cancelada e {confirmarFatura.fatura.cobrancas === 1 ? "a cobrança volta a ficar solta" : `as ${confirmarFatura.fatura.cobrancas} cobranças voltam a ficar soltas`}, sem valor faturado. Nada é baixado. Para cobrar a empresa de novo, é preciso fechar outra fatura. O cancelamento não é desfeito pela tela.
            </p>
          </ConfirmarAcao>
        )}
      </section>

      {/* Dados do contrato */}
      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-2 font-medium">Contrato corporativo</h2>
        <dl className="grid grid-cols-1 gap-1 text-sm text-gray-700 md:grid-cols-2">
          <div><dt className="inline text-gray-500">Documento: </dt><dd className="inline">{empresa.documento ?? "—"}</dd></div>
          <div><dt className="inline text-gray-500">Telefone: </dt><dd className="inline">{empresa.contatoTelefone ?? "—"}</dd></div>
          <div className="md:col-span-2"><dt className="inline text-gray-500">Observações: </dt><dd className="inline">{empresa.observacoes ?? "—"}</dd></div>
        </dl>
        <button
          className={`${botaoClasses({ variante: empresa.ativo ? "perigo" : "secundario" })} mt-3`}
          disabled={ocupado}
          onClick={() =>
            run("contrato", () =>
              salvarEmpresa({
                id: empresa.id,
                nome: empresa.nome,
                paisId: empresa.paisId ?? undefined,
                documento: empresa.documento ?? undefined,
                contatoNome: empresa.contatoNome ?? undefined,
                contatoEmail: empresa.contatoEmail ?? undefined,
                contatoTelefone: empresa.contatoTelefone ?? undefined,
                diaVencimento: empresa.diaVencimento,
                observacoes: empresa.observacoes ?? undefined,
                ativo: !empresa.ativo,
              }),
              empresa.ativo ? "Empresa inativada." : "Empresa reativada.",
            )
          }
        >
          {empresa.ativo ? "Inativar empresa" : "Reativar empresa"}
        </button>
        {feedback("contrato")}
      </section>
    </div>
  );
}
