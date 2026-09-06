-- ============================================================
-- Migration 001 — Adiciona Usuario.foto_perfil
--
-- routes/auth.py (GET/PUT /api/auth/perfil) já lê e grava essa coluna,
-- mas ela nunca existiu em database/integra_escolar.sql. Sem ela, toda
-- chamada a essas rotas falha com "Unknown column 'foto_perfil'".
--
-- Aditiva e segura para rodar em um banco já em uso: não apaga dados,
-- não recria tabelas.
--
-- Como aplicar:
--   mysql -u root -p integra_escolar < database/migrations/001_add_foto_perfil.sql
-- ============================================================

USE integra_escolar;

-- MEDIUMTEXT comporta a Data URL (base64) da foto; o backend já limita
-- o tamanho da string em 800.000 caracteres antes de gravar
-- (routes/auth.py::atualizar_perfil), então MEDIUMTEXT (até 16MB) sobra.
ALTER TABLE Usuario
  ADD COLUMN foto_perfil MEDIUMTEXT NULL DEFAULT NULL AFTER email_verificado;
