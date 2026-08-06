/* ============================================================
   Integra Escolar — Controle de Faltas (Professor)
   Conectado à API real (GET/POST /api/ocorrencias, /api/horarios,
   /api/alunos). Antes disso, tudo aqui era mockado.
   ============================================================ */

const USUARIO = getUsuarioLogado();

let HORARIOS = [];   // aulas do professor (Horario)
let FALTAS   = [];   // ocorrências categoria=Falta já mapeadas

// ── Carregamento inicial ────────────────────────────────────
async function carregarDados() {
  if (!USUARIO || !USUARIO.pessoa) return;

  try {
    const respHorarios = await apiFetch(`${API_URL}/horarios?matricula_professor=${USUARIO.pessoa.id}`);
    HORARIOS = await respHorarios.json();
    montarFiltrosDinamicos();

    const respFaltas = await apiFetch(`${API_URL}/ocorrencias?categoria=Falta&matricula_professor=${USUARIO.pessoa.id}`);
    const dados = await respFaltas.json();
    FALTAS = dados.map(mapearFalta);
  } catch (erro) {
    document.getElementById('listaAlunos').innerHTML =
      '<p style="text-align:center;color:var(--texto-secundario);padding:40px 0">Não foi possível carregar os dados agora.</p>';
    console.error('Erro ao carregar controle de faltas:', erro);
    return;
  }

  render();
}

function statusDaOcorrencia(o) {
  if (o.registrado) return 'justificada';
  if (o.motivo_rejeicao) return 'aplicada';
  return 'pendente';
}

function mapearFalta(o) {
  return {
    id: o.id_ocorrencia,
    estudante: o.aluno_nome,
    turma: o.aluno_turma,
    data: formatarDataBR(o.data_inicio_oc),
    dataISO: (o.data_inicio_oc || '').slice(0, 10),
    descricao: o.descricao,
    status: statusDaOcorrencia(o),
    mensagemGestao: o.resposta_gestao,
  };
}

// ── Filtros dinâmicos (matéria / turma vêm do horário real do professor) ──
function montarFiltrosDinamicos() {
  const materias = [...new Set(HORARIOS.map(h => h.materia))].sort();
  const turmas   = [...new Set(HORARIOS.map(h => h.turma))].sort();

  const selMateria = document.getElementById('materia');
  selMateria.innerHTML = '<option value="">Matéria</option>' +
    materias.map(m => `<option value="${m}">${m}</option>`).join('');

  const selTurma = document.getElementById('turma');
  selTurma.innerHTML = '<option value="">Turma</option>' +
    turmas.map(t => `<option value="${t}">${t}</option>`).join('');
}

// ── Renderização principal ──────────────────────────────────
function render() {
  const pesquisa = document.getElementById('pesquisa').value.toLowerCase().trim();
  const turma    = document.getElementById('turma').value;
  const status   = document.getElementById('status').value;
  const materia  = document.getElementById('materia').value;
  const dataFiltro = document.getElementById('dataFiltro').value;

  const filtradas = FALTAS.filter(f => {
    const okNome    = !pesquisa || f.estudante.toLowerCase().includes(pesquisa);
    const okTurma   = !turma    || f.turma === turma;
    const okStatus  = status === 'todos' || f.status === status;
    const okMateria = !materia  || f.descricao.startsWith(materia);
    const okData    = !dataFiltro || f.dataISO === dataFiltro;
    return okNome && okTurma && okStatus && okMateria && okData;
  });

  const lista = document.getElementById('listaAlunos');
  lista.innerHTML = filtradas.length
    ? filtradas.map(renderCard).join('')
    : '';

  atualizarContador();
  document.getElementById('semRegistros').style.display = filtradas.length === 0 ? 'block' : 'none';
}

function renderCard(f) {
  let botoes;
  if (f.status === 'pendente') {
    botoes = `
      <button class="btn btn-justificado" onclick="decidir(${f.id}, 'aprovar')">
        <i class="fa-solid fa-circle-check"></i> Justificar
      </button>
      <button class="btn btn-aplicar" onclick="decidir(${f.id}, 'rejeitar')">
        <i class="fa-solid fa-circle-xmark"></i> Aplicar Falta
      </button>`;
  } else if (f.status === 'justificada') {
    botoes = `
      <div class="status-final status-justificada">
        <i class="fa-solid fa-circle-check"></i> Falta Justificada
      </div>`;
  } else {
    botoes = `
      <div class="status-final status-aplicada">
        <i class="fa-solid fa-circle-xmark"></i> Falta Aplicada
      </div>`;
  }

  return `
    <div class="aluno-card" data-status="${f.status}">
      <div class="aluno-nome">${f.estudante}</div>
      <div class="aluno-info">
        <i class="fa-regular fa-calendar"></i> ${f.data} &nbsp;•&nbsp;
        ${f.descricao} &nbsp;•&nbsp; ${f.turma}
      </div>
      <div class="botoes">${botoes}</div>
    </div>`;
}

function atualizarContador() {
  const total = FALTAS.filter(f => f.status === 'pendente').length;
  document.getElementById('badgePendentes').textContent  = total;
  document.getElementById('textoPendencias').textContent = total + ' falta(s) aguardando decisão.';
  document.querySelector('.aviso').style.display = total === 0 ? 'none' : 'flex';
}

// ── Decidir (Justificar / Aplicar Falta) ────────────────────
async function decidir(idOcorrencia, decisao) {
  try {
    const resp = await apiFetch(`${API_URL}/ocorrencias/${idOcorrencia}/decidir`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisao })
    });
    if (!resp.ok) {
      const erro = await resp.json().catch(() => ({}));
      alert(erro.erro || 'Não foi possível registrar a decisão.');
      return;
    }
    if (decisao === 'aprovar') {
      mostrarPopup('justificada', 'Falta Justificada', 'A falta foi marcada como justificada no sistema.');
    } else {
      mostrarPopup('aplicada', 'Falta Aplicada', 'A falta foi mantida e passa a contar oficialmente.');
    }
    await carregarDados();
  } catch (erro) {
    console.error('Erro ao decidir ocorrência:', erro);
  }
}

// ── Popup de confirmação (genérico) ─────────────────────────
function mostrarPopup(tipo, titulo, texto) {
  const icone = document.getElementById('popupIcone');
  icone.className = 'check-icon' + (tipo === 'aplicada' ? ' tipo-aplicada' : tipo === 'info' ? ' tipo-info' : '');
  icone.innerHTML = tipo === 'aplicada'
    ? '<i class="fa-solid fa-circle-xmark"></i>'
    : '<i class="fa-solid fa-check"></i>';
  document.getElementById('popupTitulo').textContent = titulo;
  document.getElementById('popupTexto').textContent = texto;
  document.getElementById('popup').classList.add('show');
}

document.getElementById('fecharPopup').addEventListener('click', () => {
  document.getElementById('popup').classList.remove('show');
});
document.getElementById('popup').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('show');
});

// ── Modal: Registrar Falta ───────────────────────────────────
function abrirModalFalta() {
  const turmas = [...new Set(HORARIOS.map(h => h.turma))].sort();
  document.getElementById('faltaTurma').innerHTML =
    '<option value="">Selecione a turma...</option>' + turmas.map(t => `<option value="${t}">${t}</option>`).join('');
  document.getElementById('faltaAluno').innerHTML = '<option value="">Selecione a turma primeiro...</option>';
  document.getElementById('faltaHorario').innerHTML = '<option value="">Selecione a turma primeiro...</option>';
  document.getElementById('faltaData').value = '';
  document.getElementById('faltaErro').classList.remove('show');
  document.getElementById('modalFalta').classList.add('show');
}

function fecharModalFalta() {
  document.getElementById('modalFalta').classList.remove('show');
}

document.getElementById('modalFalta').addEventListener('click', function (e) {
  if (e.target === this) fecharModalFalta();
});

async function aoTrocarTurmaModal() {
  const turma = document.getElementById('faltaTurma').value;
  const selAluno = document.getElementById('faltaAluno');
  const selHorario = document.getElementById('faltaHorario');

  if (!turma) {
    selAluno.innerHTML = '<option value="">Selecione a turma primeiro...</option>';
    selHorario.innerHTML = '<option value="">Selecione a turma primeiro...</option>';
    return;
  }

  // Aulas: já temos em memória (vieram do /horarios ao carregar a página)
  const aulasDaTurma = HORARIOS.filter(h => h.turma === turma);
  selHorario.innerHTML = aulasDaTurma.length
    ? aulasDaTurma.map(h => `<option value="${h.id_horario}">${h.materia} — ${h.dia_da_semana} ${String(h.hr_inicio).slice(0,5)}</option>`).join('')
    : '<option value="">Nenhuma aula cadastrada para esta turma</option>';

  // Alunos: busca na API
  selAluno.innerHTML = '<option value="">Carregando...</option>';
  try {
    const resp = await apiFetch(`${API_URL}/alunos?turma=${encodeURIComponent(turma)}`);
    const alunos = await resp.json();
    selAluno.innerHTML = alunos.length
      ? '<option value="">Selecione o estudante...</option>' + alunos.map(a => `<option value="${a.matricula}">${a.nome}</option>`).join('')
      : '<option value="">Nenhum estudante nesta turma</option>';
  } catch (erro) {
    selAluno.innerHTML = '<option value="">Erro ao carregar estudantes</option>';
    console.error('Erro ao carregar estudantes da turma:', erro);
  }
}

async function enviarFalta() {
  const matricula  = document.getElementById('faltaAluno').value;
  const id_horario = document.getElementById('faltaHorario').value;
  const data       = document.getElementById('faltaData').value;
  const erroEl     = document.getElementById('faltaErro');

  if (!matricula || !id_horario || !data) {
    erroEl.textContent = 'Preencha estudante, aula e data antes de registrar.';
    erroEl.classList.add('show');
    return;
  }

  try {
    const resp = await apiFetch(`${API_URL}/ocorrencias/faltas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matricula, id_horario, data })
    });
    const resultado = await resp.json();
    if (!resp.ok) {
      erroEl.textContent = resultado.erro || 'Não foi possível registrar a falta.';
      erroEl.classList.add('show');
      return;
    }
    fecharModalFalta();
    mostrarPopup('info', 'Falta Registrada', 'A falta foi lançada e já aparece na lista de notificações.');
    await carregarDados();
  } catch (erro) {
    erroEl.textContent = 'Erro de conexão. Tente novamente.';
    erroEl.classList.add('show');
    console.error('Erro ao registrar falta:', erro);
  }
}

// ── Pesquisa e filtros ───────────────────────────────────────
document.getElementById('pesquisa').addEventListener('input', render);
['turma', 'status', 'materia', 'dataFiltro'].forEach(id => {
  document.getElementById(id).addEventListener('change', render);
});

// ── Init ──────────────────────────────────────────────────────
carregarDados();
