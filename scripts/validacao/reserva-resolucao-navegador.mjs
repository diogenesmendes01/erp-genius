import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:teste@localhost:54329/erp_genius_test' } } });
const arquivo = 'node_modules/.implementation/reserva-resolucao-navegador.json';
try {
 if (process.argv[2] === 'verificar') {
  const f = JSON.parse(await fs.readFile(arquivo, 'utf8'));
  const reserva = await db.reservaVagaMatricula.findUniqueOrThrow({where:{id:f.reservaId}});
  const propostas = await db.propostaResolucaoReserva.findMany({where:{reservaId:f.reservaId},include:{decisao:true}});
  const checks = {propostaUnica:propostas.length===1, autoria:propostas[0]?.preparadorId===f.secretariaId,
   aprovacaoIndependente:propostas[0]?.decisao?.decisorId===f.adminId && propostas[0]?.decisao?.aprovada===true,
   vagaLiberada:reserva.status==='LIBERADA', matriculaPreservada:JSON.stringify(await db.matricula.findUnique({where:{id:f.matriculaId}}))===JSON.stringify(f.matricula),
   semCobranca:await db.cobranca.count({where:{matriculaId:f.matriculaId}})===0};
  await fs.writeFile('docs/validacao-reserva-resolucao-navegador-2026-09-12.json',JSON.stringify({executadoEm:new Date().toISOString(),ambiente:'Banco local descartável; reserva mantida semeada diretamente, sem validar contratação inicial',checks},null,2));
  console.log(JSON.stringify(checks));if(Object.values(checks).some(v=>!v))process.exitCode=1;
 } else {
  const tag=Date.now().toString(),senhaHash=await bcrypt.hash('Somente-Teste-Local-2026!',10);
  const usuario=(email,papeis)=>db.usuario.upsert({where:{email},create:{email,nome:email.split('@')[0],papeis,senhaHash},update:{ativo:true,papeis,senhaHash}});
  const sec=await usuario('reserva-secretaria@validacao.test',['SECRETARIA_ACADEMICA']);
  const admin=await usuario('reserva-admin@validacao.test',['ADMINISTRADOR']);
  const produto=await db.produto.findFirstOrThrow(),pais=await db.pais.findFirstOrThrow();
  const nivel=await db.nivel.create({data:{idiomaId:produto.idiomaId,codigo:'UI'+tag,ordem:99}});
  const turma=await db.turma.create({data:{codigo:'RESERVA-UI-'+tag,nivelId:nivel.id,modalidadeId:produto.modalidadeId,capacidade:1}});
  const aluno=await db.aluno.create({data:{primeiroNome:'Aluno fictício reserva',paisId:pais.id}});
  const matricula=await db.matricula.create({data:{alunoId:aluno.id,produtoId:produto.id,paisId:pais.id,moeda:'CRC'}});
  const janela=await db.janelaAdmissaoTurma.create({data:{turmaId:turma.id,preparadorId:sec.id,versao:1,limiteEntrada:new Date('2099-12-31'),fusoAdmissao:'UTC',motivo:'Fixture navegador',chaveIdempotencia:'janela-'+tag,entradaHash:'fixture'}});
  const reserva=await db.reservaVagaMatricula.create({data:{matriculaId:matricula.id,turmaId:turma.id,janelaId:janela.id,preparadorId:sec.id,status:'MANTIDA_PENDENCIA',expiraEm:new Date('2099-10-01T12:00:00Z'),motivo:'Reserva fictícia para validação de resolução',chaveIdempotencia:'reserva-'+tag,entradaHash:'fixture'}});
  const f={reservaId:reserva.id,matriculaId:matricula.id,secretariaId:sec.id,adminId:admin.id,matricula};
  await fs.mkdir('node_modules/.implementation',{recursive:true});await fs.writeFile(arquivo,JSON.stringify(f));console.log(JSON.stringify({reservaId:reserva.id}));
 }
} finally {await db.$disconnect();}
