import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
const db = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:teste@localhost:54329/erp_genius_test' } } });
const arquivo = 'node_modules/.implementation/replanejamento-navegador.json';
try {
 if (process.argv[2] === 'verificar') {
  const f = JSON.parse(await fs.readFile(arquivo, 'utf8'));
  const registros = await db.rascunhoReplanejamento.findMany({ where: { calendarioId: f.calendarioId }, orderBy: { versao: 'asc' } });
  const encontros = await db.encontroAgenda.findMany({ where: { turmaId: f.turmaId }, orderBy: { inicio: 'asc' } });
  const r = registros[0];
  const checks = { registroUnico: registros.length === 1, autoria: r?.preparadorId === f.secretariaId,
   ajusteGuardado: r?.snapshot?.ajustes?.some(a => a.data === '2099-12-20' && a.horario === '10:00' && a.motivo === 'Ajuste validado no navegador') === true,
   agendaPreservada: JSON.stringify(encontros.map(e=>[e.id,e.inicio.toISOString(),e.fim.toISOString()])) === JSON.stringify(f.encontros),
   calendarioNaoAprovado: !(await db.decisaoCalendarioEscolar.findUnique({ where: { calendarioId: f.calendarioId } })) };
  await fs.writeFile('docs/validacao-replanejamento-navegador-2026-09-12.json', JSON.stringify({ executadoEm:new Date().toISOString(), ambiente:'Local descartável, dados fictícios; base de agenda semeada diretamente', checks },null,2));
  console.log(JSON.stringify(checks)); if(Object.values(checks).some(v=>!v)) process.exitCode=1;
 } else {
  const tag=Date.now().toString(), senhaHash=await bcrypt.hash('Somente-Teste-Local-2026!',10);
  const usuario=(email,papeis)=>db.usuario.upsert({where:{email},create:{email,nome:email.split('@')[0],papeis,senhaHash},update:{ativo:true,papeis,senhaHash}});
  const sec=await usuario('revisao-secretaria@validacao.test',['SECRETARIA_ACADEMICA']);
  const gestor=await usuario('revisao-gestor@validacao.test',['GERENTE_PEDAGOGICO']);
  const prof=await usuario('revisao-professor@validacao.test',['PROFESSOR']);
  await db.configuracaoOperacional.upsert({where:{id:'escola'},create:{id:'escola',fusoInstitucional:'UTC'},update:{fusoInstitucional:'UTC'}});
  const ultima=await db.versaoCalendarioEscolar.findFirst({orderBy:{versao:'desc'}});
  const base=await db.versaoCalendarioEscolar.create({data:{versao:(ultima?.versao??0)+1,preparadorId:sec.id,fusoInstitucional:'UTC',periodos:[],motivo:'Base fictícia para revisão '+tag,chaveIdempotencia:'base-'+tag,entradaHash:'fixture'}});
  await db.decisaoCalendarioEscolar.create({data:{calendarioId:base.id,decisorId:gestor.id,aprovada:true,motivo:'Fixture de agenda previamente publicada'}});
  const modalidade=await db.modalidade.create({data:{nome:'Revisão UI '+tag,frequencia:'2x/semana',duracaoPorNivel:'3 aulas',aulasPorNivel:3,horasAula:1}});
  const idioma=await db.idioma.findFirstOrThrow();
  const nivel=await db.nivel.create({data:{idiomaId:idioma.id,codigo:'REV'+tag,ordem:51}});
  const turma=await db.turma.create({data:{codigo:'REVISAO-UI-'+tag,modalidadeId:modalidade.id,nivelId:nivel.id,professorId:prof.id,diasSemana:[2,4],horarioInicio:'19:00',horarioFim:'20:00',dataInicio:new Date('2099-10-01'),dataFim:new Date('2099-11-01')}});
  const grade=await db.propostaGradeTurma.create({data:{turmaId:turma.id,calendarioId:base.id,preparadorId:sec.id,versao:1,fusoOrigem:'UTC',motivo:'Grade fictícia',chaveIdempotencia:'grade-'+tag,entradaHash:'fixture',snapshot:{origem:{dataInicial:'2099-10-01',diasSemana:[2,4],horario:'19:00',duracaoMinutos:60,quantidadeAulas:3}}}});
  await db.decisaoGradeTurma.create({data:{propostaId:grade.id,decisorId:gestor.id,aprovada:true,motivo:'Fixture de grade publicada'}});
  const encontros=[];
  for(const dia of ['2099-10-01','2099-10-06','2099-10-08']) {
   const e=await db.encontroAgenda.create({data:{turmaId:turma.id,propostaGradeId:grade.id,professorId:prof.id,preparadorId:sec.id,inicio:new Date(dia+'T19:00:00Z'),fim:new Date(dia+'T20:00:00Z'),fusoOrigem:'UTC',status:'PREVISTO',motivo:'Fixture',chaveIdempotencia:tag+dia,entradaHash:'fixture'}});
   encontros.push([e.id,e.inicio.toISOString(),e.fim.toISOString()]);
  }
  const calendario=await db.versaoCalendarioEscolar.create({data:{versao:base.versao+1,preparadorId:sec.id,fusoInstitucional:'UTC',periodos:[{id:'feriado',nome:'Feriado de revisão',tipo:'FERIADO',inicio:'2099-10-01',fim:'2099-10-01'}],motivo:'Calendário para ensaio '+tag,chaveIdempotencia:'novo-'+tag,entradaHash:'fixture'}});
  const f={calendarioId:calendario.id,turmaId:turma.id,codigo:turma.codigo,secretariaId:sec.id,encontros};
  await fs.mkdir('node_modules/.implementation',{recursive:true});await fs.writeFile(arquivo,JSON.stringify(f));console.log(JSON.stringify(f));
 }
} finally { await db.$disconnect(); }
