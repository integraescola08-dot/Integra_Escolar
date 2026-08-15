 // ── Dados do usuário logado ──────────────────────────────────────────────
  // Esta página roda dentro de um <iframe> em home.html. Ela não tem acesso
  // direto ao localStorage da página pai, então recebe os dados do usuário
  // por postMessage (ver assets/js/header.js -> enviarDadosParaFrame).
  let USUARIO = null;
  let API_BASE = null;
  let ATESTADOS = [];
  let LIBERACOES = [];

  window.addEventListener('message', function(e){
    if(e.data && e.data.tipo === 'integra:usuario'){
      USUARIO = e.data.usuario;
      API_BASE = e.data.apiUrl;
      carregarHistorico();
    }
  });

  // Se a página pai ainda não tiver enviado os dados (ex.: iframe recarregado
  // isoladamente), pede explicitamente.
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ tipo: 'integra:pedir-usuario' }, window.location.origin);
  }

  // ── Busca os dados reais na API ──────────────────────────────────────────
  async function carregarHistorico() {
    if (!USUARIO || !API_BASE) return;

    // Responsável só vê o histórico dos próprios filhos; gestão e
    // administrador acompanham as ocorrências de todos os alunos da escola.
    const ehResponsavel = USUARIO.perfil === 'responsavel';
    if (ehResponsavel && !USUARIO.pessoa) return;

    const filtroResponsavel = ehResponsavel ? `&id_responsavel=${USUARIO.pessoa.id}` : '';

    try {
      const [respAtestados, respLiberacoes] = await Promise.all([
        apiFetch(`${API_BASE}/ocorrencias?categoria=Atestado${filtroResponsavel}`),
        apiFetch(`${API_BASE}/ocorrencias?categoria=Liberacao${filtroResponsavel}`)
      ]);
      const dadosAtestados = await respAtestados.json();
      const dadosLiberacoes = await respLiberacoes.json();

      ATESTADOS = dadosAtestados.map(mapearAtestado);
      LIBERACOES = dadosLiberacoes.map(mapearLiberacao);
    } catch (erro) {
      document.getElementById('list').innerHTML = `
        <div class="empty"><p>Não foi possível carregar o histórico agora.</p></div>`;
      console.error('Erro ao carregar histórico:', erro);
      return;
    }
    render();
  }

  function statusDaOcorrencia(o) {
    if (o.registrado) return 'aprovado';
    if (o.motivo_rejeicao) return 'rejeitado';
    return 'pendente';
  }

  // Reconstrói "tipo" e "observação" a partir da descrição salva
  // (formato gravado pelo backend: "Tipo. Observações").
  function separarDescricao(descricao) {
    if (!descricao) return { tipo: 'Atestado Médico', observacao: '' };
    const [tipo, ...resto] = descricao.split('. ');
    return { tipo: tipo || 'Atestado Médico', observacao: resto.join('. ') };
  }

  function mapearAtestado(o) {
    const { tipo, observacao } = separarDescricao(o.descricao);
    const dataBase = o.data_inicio_oc || o.data_da_criacao;
    return {
      id: o.id_ocorrencia,
      estudante: o.aluno_nome,
      data: formatarDataBR(dataBase),
      dataISO: (dataBase || '').slice(0, 10),
      tipo,
      status: statusDaOcorrencia(o),
      arquivo: o.arquivo,
      observacao,
      mensagemGestao: o.resposta_gestao,
      dataDecisao: null,
      aprovadorId: o.aprovador_id,
      aprovadorNome: o.aprovador_nome,
      aprovadorPerfil: o.aprovador_perfil
    };
  }

  function mapearLiberacao(o) {
    const { tipo: motivo } = separarDescricao(o.descricao);
    return {
      id: o.id_ocorrencia,
      estudante: o.aluno_nome,
      data: formatarDataBR(o.data_inicio_oc),
      dataISO: (o.data_inicio_oc || '').slice(0, 10),
      horario: formatarHora(o.hora_saida),
      motivo,
      status: statusDaOcorrencia(o),
      responsavel: o.responsavel_nome,
      mensagemGestao: o.resposta_gestao,
      dataDecisao: null,
      aprovadorId: o.aprovador_id,
      aprovadorNome: o.aprovador_nome,
      aprovadorPerfil: o.aprovador_perfil
    };
  }

  // ── Estado ─────────────────────────────────────────────────────────────────
  let activeTab = 'atestados';

  // ── Helpers de badge ───────────────────────────────────────────────────────
  const STATUS_LABEL = { aprovado: 'Aprovado', pendente: 'Pendente', rejeitado: 'Rejeitado' };

  const ICON_CHECK = `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  const ICON_ALERT = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const ICON_X     = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>`;
  const ICON_MSG   = `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
  const ICON_FILE  = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  const ICON_CAL   = `<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  const ICON_CLOCK = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const ICON_USER  = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
  const ICON_DOC   = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

  function badgeIcon(status) {
    if (status === 'aprovado')  return ICON_CHECK;
    if (status === 'rejeitado') return ICON_X;
    return ICON_ALERT;
  }

  function badge(status) {
    return `<span class="badge ${status}">${badgeIcon(status)} ${STATUS_LABEL[status]}</span>`;
  }

  // ── Botão de cancelar (só enquanto pendente, e só para o próprio responsável) ──
  function botaoCancelar(id, status) {
    if (status !== 'pendente') return '';
    if (!USUARIO || USUARIO.perfil !== 'responsavel') return '';
    return `<button class="btn-cancelar" onclick="cancelarOcorrencia(${id})">${ICON_X} Cancelar solicitação</button>`;
  }

  async function cancelarOcorrencia(id) {
    if (!confirm('Tem certeza que deseja cancelar esta solicitação? Essa ação não pode ser desfeita.')) return;

    try {
      const resposta = await apiFetch(`${API_BASE}/ocorrencias/${id}`, { method: 'DELETE' });

      // Se o servidor cair em algum erro não tratado (raro, mas possível),
      // a resposta pode não ser JSON — aqui evitamos que isso quebre a tela
      // com uma mensagem de erro genérica em vez de um erro de parsing.
      let resultado = {};
      try { resultado = await resposta.json(); } catch { /* resposta sem corpo JSON */ }

      if (!resposta.ok) throw new Error(resultado.erro || 'Não foi possível cancelar a solicitação. Tente novamente.');

      ATESTADOS = ATESTADOS.filter(item => item.id !== id);
      LIBERACOES = LIBERACOES.filter(item => item.id !== id);
      render();
    } catch (erro) {
      alert(erro.message);
    }
  }

  function gestaoBlock(status, msg, data, aprovadorId, aprovadorNome, aprovadorPerfil) {
    if (!msg && !aprovadorId) return '';
    const decisao = aprovadorId ? `
      <div class="gestao-aprovador">
        <strong>${status === 'aprovado' ? 'Aprovado' : 'Rejeitado'} por:</strong>
        ${escapeHtml(aprovadorNome || 'Usuário')} — ${escapeHtml(aprovadorPerfil || 'Usuário')}
        <span class="gestao-aprovador-id">ID ${escapeHtml(aprovadorId)}</span>
      </div>` : '';
    return `
      <div class="gestao-msg ${status}">
        ${ICON_MSG}
        <div>
          ${decisao}
          ${msg ? `<div class="gestao-msg-label">Mensagem da Gestão${data ? ' — ' + escapeHtml(data) : ''}</div>
          <div class="gestao-msg-text">${escapeHtml(msg)}</div>` : ''}
        </div>
      </div>`;
  }

  // Abre o anexo (atestado/declaração) enviado pelo responsável. Não usamos um
  // <a href> comum porque o arquivo fica atrás de login (token no header) —
  // então baixamos com apiFetch e abrimos o resultado como blob numa aba nova.
  async function abrirAnexo(evento, nomeArquivo) {
    evento.preventDefault();
    try {
      const resposta = await apiFetch(`${window.location.origin}/uploads/${encodeURIComponent(nomeArquivo)}`);
      if (!resposta.ok) throw new Error('Não foi possível abrir o arquivo.');
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Libera a memória depois de um tempo — a aba já teve tempo de carregar o arquivo.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (erro) {
      alert(erro.message || 'Não foi possível abrir o arquivo.');
    }
  }

  // ── Render de atestado ─────────────────────────────────────────────────────
  function renderAtestado(a) {
    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-name">${escapeHtml(a.estudante)}</div>
            <div class="item-meta">
              ${ICON_CAL} ${escapeHtml(a.data)}
              <span class="dot">•</span>
              ${ICON_DOC} ${escapeHtml(a.tipo)}
            </div>
          </div>
          ${badge(a.status)}
        </div>
        <div class="info-box">
          <div class="info-box-row"> <a href="#" onclick="abrirAnexo(event, '${escapeHtml(a.arquivo)}')" style="display: flex; align-items: center; gap: 8px; color: #1a56a0; text-decoration: none; font-weight: 600; cursor: pointer;"> ${ICON_FILE} Visualizar documento (${escapeHtml(a.arquivo)}) </a> </div>
          ${a.observacao ? `<div class="info-box-row" style="color:#64748b;font-style:italic">${escapeHtml(a.observacao)}</div>` : ''}
        </div>
        ${gestaoBlock(a.status, a.mensagemGestao, a.dataDecisao, a.aprovadorId, a.aprovadorNome, a.aprovadorPerfil)}
        ${botaoCancelar(a.id, a.status)}
      </div>`;
  }

  // ── Render de liberação ────────────────────────────────────────────────────
  function renderLiberacao(l) {
    return `
      <div class="item-card">
        <div class="item-top">
          <div>
            <div class="item-name">${escapeHtml(l.estudante)}</div>
            <div class="item-meta">
              ${ICON_CAL} ${escapeHtml(l.data)}
              <span class="dot">•</span>
              ${ICON_CLOCK} ${escapeHtml(l.horario)}
            </div>
          </div>
          ${badge(l.status)}
        </div>
        <div class="info-box">
          <div class="info-box-row">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            <strong style="color:#475569">Motivo:</strong> ${escapeHtml(l.motivo)}
          </div>
          <div class="info-box-row">${ICON_USER} <strong style="color:#475569">Responsável:</strong> ${escapeHtml(l.responsavel)}</div>
        </div>
        ${gestaoBlock(l.status, l.mensagemGestao, l.dataDecisao, l.aprovadorId, l.aprovadorNome, l.aprovadorPerfil)}
        ${botaoCancelar(l.id, l.status)}
      </div>`;
  }

  // ── Renderização principal ─────────────────────────────────────────────────
  function render() {
    const dataDe  = document.getElementById('filtro-de').value;   // 'YYYY-MM-DD' ou ''
    const dataAte = document.getElementById('filtro-ate').value;  // 'YYYY-MM-DD' ou ''
    const status  = document.getElementById('filtro-status').value;
    const list    = document.getElementById('list');
    const count   = document.getElementById('result-count');

    const source = activeTab === 'atestados' ? ATESTADOS : LIBERACOES;

    const filtered = source.filter(item => {
      const dataOk   = (!dataDe || item.dataISO >= dataDe) && (!dataAte || item.dataISO <= dataAte);
      const statusOk = !status || item.status === status;
      return dataOk && statusOk;
    });

    count.textContent = filtered.length
      ? `${filtered.length} registro${filtered.length > 1 ? 's' : ''} encontrado${filtered.length > 1 ? 's' : ''}`
      : '';

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <p>Nenhum registro encontrado para o período selecionado</p>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(item =>
      activeTab === 'atestados' ? renderAtestado(item) : renderLiberacao(item)
    ).join('');
  }

  // ── Filtros rápidos de período ──────────────────────────────────────────────
  function paraISO(d) { return d.toISOString().slice(0, 10); }

  function setPeriodo(periodo, chip) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const hoje = new Date();
    const de   = document.getElementById('filtro-de');
    const ate  = document.getElementById('filtro-ate');

    if (periodo === 'todos') {
      de.value = ''; ate.value = '';
    } else if (periodo === 'hoje') {
      de.value = paraISO(hoje); ate.value = paraISO(hoje);
    } else if (periodo === '7dias') {
      const seteDiasAtras = new Date(hoje); seteDiasAtras.setDate(hoje.getDate() - 6);
      de.value = paraISO(seteDiasAtras); ate.value = paraISO(hoje);
    } else if (periodo === 'mes') {
      const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      de.value = paraISO(primeiroDia); ate.value = paraISO(hoje);
    }
    render();
  }

  // Se o usuário digitar/escolher uma data manualmente no calendário,
  // nenhum chip de atalho corresponde mais — volta tudo para "Todos" visualmente
  // apenas se as duas datas estiverem vazias; senão, desmarca os chips.
  function onDataManualAlterada() {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const de = document.getElementById('filtro-de').value;
    const ate = document.getElementById('filtro-ate').value;
    if (!de && !ate) document.querySelector('.chip[data-periodo="todos"]').classList.add('active');
    render();
  }

  // ── Troca de aba ──────────────────────────────────────────────────────────
  function switchTab(tab, btn) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('filtro-de').value = '';
    document.getElementById('filtro-ate').value = '';
    document.getElementById('filtro-status').value = '';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-periodo="todos"]').classList.add('active');
    render();
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  // (a lista é preenchida em carregarHistorico(), assim que os dados do
  // usuário chegam via postMessage — até lá, fica o aviso "Carregando...")

  // Restringe os calendários "De" e "Até" ao ano atual.
  (function configurarCalendariosHistorico() {
    const anoAtual = new Date().getFullYear();
    const de = document.getElementById('filtro-de');
    const ate = document.getElementById('filtro-ate');
    [de, ate].forEach(input => {
      if (!input) return;
      input.min = `${anoAtual}-01-01`;
      input.max = `${anoAtual}-12-31`;
    });
  })();

  