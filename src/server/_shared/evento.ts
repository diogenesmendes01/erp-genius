import { Prisma } from "@prisma/client";

export type AgregadoTipo =
  | "RegraAvaliacao"
  | "ModeloContratual"
  | "ConfiguracaoOperacional"
  | "PoliticaComissao"
  | "CoberturaCarteira"
  | "AtendimentoWhatsApp"
  | "PagamentoInformado"
  | "Recebimento"
  | "SolicitacaoCorrecaoCadastro"
  | "AulaDiario"
  | "EncontroAgenda"
  | "VinculoDocente"
  | "Exportacao"
  | "Importacao"
  | "Lead"
  | "Matricula"
  | "Aluno"
  | "Responsavel"
  | "Cobranca"
  | "Comissao"
  | "Turma"
  | "Pais"
  | "Usuario"
  | "Idioma"
  | "Modalidade"
  | "Nivel"
  | "Produto"
  | "ProdutoPais"
  | "Preco"
  | "TaxaCambio"
  | "NumeroWhatsApp"
  | "ContatoWhatsApp"
  | "GrupoWhatsApp"
  | "TemplateWhatsApp"
  | "IntencaoMensagem"
  | "PoliticaRegua"
  | "LotePreparacaoMigracao"
  | "ConfigFinanceiro"
  | "Empresa"
  | "FaturaB2B"
  | "Pessoa"
  | "Tarefa"
  | "Tag"
  | "CampoPersonalizado"
  | "FiltroSalvo"
  | "AgenteIA"
  | "VersaoAgenteIA"
  | "AcaoAgenteIA"
  | "FonteConhecimento"
  | "ConfigIA"
  | "MetaComercial"
  | "ConfigSetorAtendimento"
  | "EnvelopeAssinaturaSimulado";

export interface EntradaEvento {
  tipo: string;
  agregadoTipo: AgregadoTipo;
  agregadoId: string;
  autorId?: string | null;
  payload?: Prisma.InputJsonValue;
  versao?: number;
}

export async function registrarEvento(
  tx: Prisma.TransactionClient,
  entrada: EntradaEvento,
) {
  return tx.evento.create({
    data: {
      tipo: entrada.tipo,
      agregadoTipo: entrada.agregadoTipo,
      agregadoId: entrada.agregadoId,
      autorId: entrada.autorId ?? null,
      payload: entrada.payload,
      versao: entrada.versao ?? 1,
    },
  });
}
