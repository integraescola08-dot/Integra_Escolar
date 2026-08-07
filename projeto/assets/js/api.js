// Antes: URL fixa em 127.0.0.1, só funcionava rodando local.
// Agora: usa o mesmo domínio/porta de onde a página foi carregada, então
// funciona sem alteração tanto em localhost quanto no servidor de produção
// (o Flask serve o front-end e a API no mesmo host).
const API_URL = `${window.location.origin}/api`;

// Utilitário compartilhado: escapa texto antes de inserir em innerHTML,
// evitando que nomes/observações digitados por usuários (ex.: "motivo" de
// uma liberação, "nome" no cadastro) sejam interpretados como HTML/script.
function escapeHtml(texto) {
  // Escapa também aspas: o texto entra tanto em conteúdo de tag quanto
  // dentro de atributos (ex.: title="${...}"), e aspas não escapadas
  // permitem "quebrar" um atributo e injetar HTML/JS ali.
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
