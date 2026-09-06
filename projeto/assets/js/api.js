const API_URL = `${window.location.origin}/api`;

function escapeHtml(texto) {
  return (texto === null || texto === undefined ? '' : String(texto))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getUsuarioLogado() {
  try { return JSON.parse(localStorage.getItem('usuarioIntegra')); }
  catch { return null; }
}

function getToken() {
  return localStorage.getItem('integraToken');
}

function limparSessao() {
  localStorage.removeItem('usuarioIntegra');
  localStorage.removeItem('integraToken');
}

// Manda de volta pro login. Funciona tanto numa página cheia quanto de
// dentro de um iframe (telas que rodam na esteira de home.html).
function irParaLogin() {
  // Toda página interna mora em pages/<perfil>/, então ../../index.html
  // sempre chega certo na raiz do projeto.
  const destino = '../../index.html';
  if (window.parent && window.parent !== window) {
    window.parent.location.href = destino;
  } else {
    window.location.href = destino;
  }
}

// Fetch "inteligente": usa em toda chamada à API (exceto o login em si).
// Já inclui o token de autenticação automaticamente e, se a sessão tiver
// expirado ou for inválida (401), limpa tudo e manda de volta pro login
// sozinho — nenhuma tela precisa tratar isso na mão.
async function apiFetch(url, opcoes = {}) {
  const token = getToken();
  const cabecalhos = { ...(opcoes.headers || {}) };
  if (token) cabecalhos['Authorization'] = `Bearer ${token}`;

  const resposta = await fetch(url, { ...opcoes, headers: cabecalhos });

  if (resposta.status === 401) {
    limparSessao();
    irParaLogin();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  return resposta;
}

// Atualização automática por polling (reaproveitada por gestao.js, admin.js,
// porteiro.js, professor.js e historico.js). Chama periodicamente a MESMA
// função de carregamento que a tela já usa — nunca faz location.reload(),
// então filtros, formulários abertos e a posição da tela não se perdem.
// - funcaoAtualizar: função (pode ser async) que já existe na tela e sabe
//   redesenhar só a área de dados necessária.
// - opcoes.intervalo: intervalo em ms (padrão 10000 = 10s, como pedido).
// - opcoes.podeAtualizar: função que retorna false para pular um ciclo
//   (ex.: enquanto um modal de edição está aberto).
function iniciarAtualizacaoAutomatica(funcaoAtualizar, opcoes = {}) {
  const intervalo = opcoes.intervalo || 10000;
  const podeAtualizar = opcoes.podeAtualizar || (() => true);

  const executar = async () => {
    // Aba em segundo plano: não gasta requisição à toa.
    if (document.hidden) return;
    if (!podeAtualizar()) return;
    try {
      await funcaoAtualizar();
    } catch (erro) {
      // Atualização automática nunca deve interromper o uso da tela;
      // só registra no console para depuração.
      console.error('Atualização automática falhou:', erro);
    }
  };

  const idIntervalo = setInterval(executar, intervalo);
  // Se o usuário volta pra aba depois de um tempo fora, atualiza na hora
  // em vez de esperar o próximo ciclo do setInterval.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) executar();
  });
  return idIntervalo;
}

// Validação de nome compartilhada entre cadastro.js e admin.js. Espelha a
// mesma regra do backend (validadores.py::nome_valido): nome e sobrenome,
// só letras (com acentos comuns do português), espaço, hífen e apóstrofo.
const NOME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['-][A-Za-zÀ-ÖØ-öø-ÿ]+)*(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['-][A-Za-zÀ-ÖØ-öø-ÿ]+)*)+$/;
function nomeValido(valor) {
  const nome = String(valor || '').trim();
  return nome.length >= 3 && nome.length <= 150 && NOME_REGEX.test(nome);
}

function formatarDataBR(dataIso) {
  if (!dataIso) return '';
  const [ano, mes, dia] = String(dataIso).slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarHora(hora) {
  return hora ? String(hora).slice(0, 5) : '';
}

// Proteção visual das páginas por perfil.
// A segurança das operações continua no Flask/JWT; este bloqueio evita que
// alguém abra manualmente a URL de uma área que não pertence ao seu perfil.
(function protegerPaginaAtual() {
  const caminho = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const perfisPorPasta = [
    ['/pages/responsavel/', 'responsavel'],
    ['/pages/professor/', 'professor'],
    ['/pages/porteiro/', 'porteiro'],
    ['/pages/gestao/', 'gestao'],
    ['/pages/administrador/', 'administrador']
  ];

  const regra = perfisPorPasta.find(([pasta]) => caminho.includes(pasta));
  if (!regra) return; // login/cadastro e outros arquivos públicos

  const usuario = getUsuarioLogado();
  const token = getToken();
  const perfilEsperado = regra[1];

  if (!usuario || !token || usuario.perfil !== perfilEsperado) {
    limparSessao();
    irParaLogin();
  }
})();
