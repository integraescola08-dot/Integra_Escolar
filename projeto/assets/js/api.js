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
