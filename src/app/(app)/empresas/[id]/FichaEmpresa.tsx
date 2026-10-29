"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColaboradorRelatorio, FaturaResumo } from "@/server/empresas/consultas";
import {
  cancelarFaturaB2B,
  definirSituacaoEmpresa,
  pagarFaturaB2B,
} from "@/server/empresas/acoes";
import { FeedbackAcao } from "@/components/FeedbackAcao";
import { ConfirmarAcao } from "@/components/ConfirmarAcao";
import { formatarMoeda } from "@/lib/dinheiro";
import { STATUS_MATRICULA_LABEL, rotular, STATUS_FATURA_B2B_LABEL } from "@/lib/labels";
import { useAcaoCliente } from "@/lib/acao-cliente";
import type { Resultado } from "@/server/_shared/resultado";
import { formatarCompetencia, formatarDataCivil } from "@/lib/data-civil";
import { botaoClasses } from "@/components/Botao";
import { EstadoVazio } from "@/components/EstadoVazio";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Aviso } from "@/components/Aviso";
import { COBRANCA_B2B_ATIVA, MSG_COBRANCA_B2B_DESLIGADA } from "@/lib/funcionalidades";

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
  podeEditar = true,
}: {
  empresa: EmpresaFicha;
  colaboradores: ColaboradorRelatorio[];
  faturas: FaturaResumo[];
  produtos: { id: string; label: string }[];
  competencias: string[];
  podePagar: boolean;
  podeEditar?: boolean;
}) {
  const router = useRouter();
  const acao = useAcaoCliente({ idempotente: false });
  const [origem, setOrigem] = useState<"faturas" | "contrato" | null>(null);
  const ocupado = acao.ocupado;

  async function run<T>(secao: "faturas" | "contrato", disparar: () => Promise<Resultado<T>>, sucesso: string) {
    setOrigem(secao);
    if ((await acao.executar(disparar, sucesso))?.tipo === "ok") router.refresh();
  }
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
  const [confirmarInativacao, setConfirmarInativacao] = useState(false);
  function pedirInativacao() {
    setOrigem("contrato");
    acao.limpar();
    setConfirmarInativacao(true);
  }
  function inativada() {
    setConfirmarInativacao(false);
    setOrigem("contrato");
    acao.setSucesso("Empresa inativada.");
    router.refresh();
  }
  const faturasEmAberto = faturas.filter((f: FaturaResumo) => f.status === "FECHADA").length;
  const feedback = (secao: "faturas" | "contrato") => (
    <FeedbackAcao erro={origem === secao ? acao.erro : null} sucesso={origem === secao ? acao.sucesso : null} className="mt-3" />
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-medium">{empresa.nome}</h1>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">B2B</span>
          {!empresa.ativo && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-gray-500">Inativa</span>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {empresa.codigo ?? "—"} · vencimento dia {empresa.diaVencimento}
          {empresa.contatoNome ? ` · contato: ${empresa.contatoNome}` : ""}
          {empresa.contatoEmail ? ` (${empresa.contatoEmail})` : ""}
        </p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Colaboradores ({colaboradores.length})</h2>
          {podeEditar && <Link className={btnPri} href="/matriculas/nova">Preparar matrícula individual</Link>}
        </div>
        <p className="mb-4 text-sm text-gray-500">A empresa pode ser o responsável financeiro, mas cada colaborador é preparado e contratado individualmente.</p>

        {colaboradores.length === 0 ? (
          <EstadoVazio>Nenhum contrato individual vinculado a esta empresa ainda.</EstadoVazio>
        ) : (
          <Table>
              <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 font-medium">Colaborador</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Matrícula</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Status</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Pagas</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Abertas</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Atrasadas</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Total pago</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores.map((c) => (
                  <TableRow key={c.matriculaId}>
                    <TableCell className="px-3 py-2">
                      <Link href={`/alunos/${c.alunoId}`} className="font-medium text-gray-800 hover:underline">
                        {c.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-500">{c.codigo ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">{rotular(STATUS_MATRICULA_LABEL, c.statusMatricula)}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-700">{c.mensalidadesPagas}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-700">{c.mensalidadesAbertas}</TableCell>
                    <TableCell className={"px-3 py-2 " + (c.mensalidadesAtrasadas > 0 ? "font-medium text-red-600" : "text-gray-700")}>
                      {c.mensalidadesAtrasadas}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-700">
                      {formatarMoeda(c.totalPago, c.moeda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-3 font-medium">Faturas históricas</h2>
        {!COBRANCA_B2B_ATIVA && faturas.length > 0 && <Aviso tom="info" className="mb-3">{MSG_COBRANCA_B2B_DESLIGADA}</Aviso>}

        {faturas.length === 0 ? (
          <EstadoVazio>
            Nenhuma fatura histórica vinculada a esta empresa.
          </EstadoVazio>
        ) : (
          <Table>
              <TableHeader className="bg-surface-muted text-left text-xs text-gray-500">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-3 py-2 font-medium">Fatura</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Competência</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Cobranças</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Total</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Vencimento</TableHead>
                  <TableHead className="px-3 py-2 font-medium">Status</TableHead>
                  <TableHead className="px-3 py-2 font-medium"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faturas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="px-3 py-2 font-medium text-gray-800">{f.codigo ?? "—"}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">{formatarCompetencia(f.competencia)}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">{f.cobrancas}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-800">
                      {formatarMoeda(f.valorTotal, f.moeda)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">{formatarDataCivil(f.vencimento.slice(0, 10))}</TableCell>
                    <TableCell className="px-3 py-2 text-gray-600">{rotular(STATUS_FATURA_B2B_LABEL, f.status)}</TableCell>
                    <TableCell className="px-3 py-2">
                      {f.status === "FECHADA" && (
                        <span className="flex flex-wrap gap-3">
                          {COBRANCA_B2B_ATIVA && podePagar && (
                            <button
                              className={btnPri}
                              disabled={ocupado}
                              onClick={() => pedirConfirmacao(f, "pagar")}
                            >
                              Registrar pagamento
                            </button>
                          )}
                          {podeEditar && (
                            <button
                              className={botaoClasses({ variante: "perigo" })}
                              disabled={ocupado}
                              onClick={() => pedirConfirmacao(f, "cancelar")}
                            >
                              Cancelar fatura
                            </button>
                          )}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

      <section className="rounded-lg border border-gray-200 bg-surface p-4">
        <h2 className="mb-2 font-medium">Contrato corporativo</h2>
        <dl className="grid grid-cols-1 gap-1 text-sm text-gray-700 md:grid-cols-2">
          <div><dt className="inline text-gray-500">Documento: </dt><dd className="inline">{empresa.documento ?? "—"}</dd></div>
          <div><dt className="inline text-gray-500">Telefone: </dt><dd className="inline">{empresa.contatoTelefone ?? "—"}</dd></div>
          <div className="md:col-span-2"><dt className="inline text-gray-500">Observações: </dt><dd className="inline">{empresa.observacoes ?? "—"}</dd></div>
        </dl>
        {podeEditar && (
          <button
            className={`${botaoClasses({ variante: empresa.ativo ? "perigo" : "secundario" })} mt-3`}
            disabled={ocupado || confirmarInativacao}
            onClick={() => (empresa.ativo ? pedirInativacao() : run("contrato", () => definirSituacaoEmpresa(empresa.id, true), "Empresa reativada."))}
          >
            {empresa.ativo ? "Inativar empresa" : "Reativar empresa"}
          </button>
        )}
        {feedback("contrato")}
        {confirmarInativacao && (
          <ConfirmarAcao
            titulo={`Inativar a empresa ${empresa.nome}?`}
            confirmacao="inativação da empresa"
            idempotente
            acao={() => definirSituacaoEmpresa(empresa.id, false)}
            aoConcluir={inativada}
            aoCancelar={() => setConfirmarInativacao(false)}
          >
            <p>
              {empresa.nome}{empresa.codigo ? ` (${empresa.codigo})` : ""} passa a inativa.{" "}
              {colaboradores.length === 1 ? "O contrato individual vinculado continua" : `Os ${colaboradores.length} contratos individuais vinculados continuam`} como
              {colaboradores.length === 1 ? " está" : " estão"}, e {faturasEmAberto === 1 ? "a fatura em aberto também" : `as ${faturasEmAberto} faturas em aberto também`}: nada é cancelado nem baixado.
            </p>
            <p>Para voltar, use &quot;Reativar empresa&quot; nesta ficha.</p>
          </ConfirmarAcao>
        )}
      </section>
    </div>
  );
}
