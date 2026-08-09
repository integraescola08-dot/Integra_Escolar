-- ============================================================
--  Integra Escolar — Atualização segura e única do banco
--  ============================================================
--  Este é o ÚNICO script que você precisa rodar para deixar o
--  banco em dia, não importa quais dos scripts antigos (
--  banco_completo.sql, ajustes_v3_1.sql, migracao_administrador.sql)
--  você já rodou antes ou não.
--
--  Ele só ADICIONA o que estiver faltando — nunca apaga tabelas,
--  colunas ou dados que já existem. Pode rodar quantas vezes
--  quiser, em qualquer ordem, sem risco.
--
--  Como rodar (linha de comando):
--      mysql -u seu_usuario -p integra_escolar < database/atualizar_banco.sql
--
--  Depois de confirmar que tudo continua funcionando, os arquivos
--  banco_completo.sql, ajustes_v3_1.sql e migracao_administrador.sql
--  podem ser apagados — todo o conteúdo deles já está aqui.
-- ============================================================

USE integra_escolar;

DELIMITER $$

DROP PROCEDURE IF EXISTS _add_coluna_se_faltar $$
CREATE PROCEDURE _add_coluna_se_faltar(
    IN p_tabela VARCHAR(64),
    IN p_coluna VARCHAR(64),
    IN p_definicao TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = p_tabela AND column_name = p_coluna
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', p_tabela, ' ADD COLUMN ', p_coluna, ' ', p_definicao);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DROP PROCEDURE IF EXISTS _add_indice_se_faltar $$
CREATE PROCEDURE _add_indice_se_faltar(
    IN p_tabela VARCHAR(64),
    IN p_indice VARCHAR(64),
    IN p_colunas VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = p_tabela AND index_name = p_indice
    ) THEN
        SET @sql = CONCAT('CREATE INDEX ', p_indice, ' ON ', p_tabela, ' (', p_colunas, ')');
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DELIMITER ;

-- ------------------------------------------------------------
-- 1) Usuario: colunas de auditoria + nível 5 (Administrador)
-- ------------------------------------------------------------
CALL _add_coluna_se_faltar('Usuario', 'ativo',            'BOOLEAN NOT NULL DEFAULT TRUE AFTER nivel_acesso');
CALL _add_coluna_se_faltar('Usuario', 'email_verificado',  'BOOLEAN NOT NULL DEFAULT FALSE AFTER ativo');
CALL _add_coluna_se_faltar('Usuario', 'criado_em',         'DATETIME DEFAULT CURRENT_TIMESTAMP AFTER email_verificado');
CALL _add_coluna_se_faltar('Usuario', 'atualizado_em',     'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em');

-- Garante que o nível 5 sempre é aceito, independente do que a
-- restrição já permitia antes (1-4 ou 1-5).
SET @constraint_existe = (
    SELECT COUNT(*) FROM information_schema.table_constraints
    WHERE table_schema = DATABASE() AND table_name = 'Usuario' AND constraint_name = 'chk_usuario_nivel'
);
SET @sql_drop = IF(@constraint_existe > 0, 'ALTER TABLE Usuario DROP CHECK chk_usuario_nivel', 'SELECT 1');
PREPARE stmt FROM @sql_drop; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE Usuario ADD CONSTRAINT chk_usuario_nivel CHECK (nivel_acesso IN (1, 2, 3, 4, 5));

-- ------------------------------------------------------------
-- 2) Aluno: colunas de auditoria + responsável passa a ser opcional
-- ------------------------------------------------------------
CALL _add_coluna_se_faltar('Aluno', 'ativo',            'BOOLEAN NOT NULL DEFAULT TRUE AFTER id_responsavel');
CALL _add_coluna_se_faltar('Aluno', 'email_verificado', 'BOOLEAN NOT NULL DEFAULT FALSE AFTER ativo');
CALL _add_coluna_se_faltar('Aluno', 'criado_em',        'DATETIME DEFAULT CURRENT_TIMESTAMP AFTER email_verificado');

ALTER TABLE Aluno MODIFY COLUMN id_responsavel INT UNSIGNED NULL;

-- ------------------------------------------------------------
-- 3) Ocorrencia: campos usados por atestado/liberação
-- ------------------------------------------------------------
CALL _add_coluna_se_faltar('Ocorrencia', 'categoria',
    'ENUM(''Atestado'',''Liberacao'',''Falta'',''Atraso'',''Outro'') NOT NULL DEFAULT ''Outro'' AFTER id_ocorrencia');
CALL _add_coluna_se_faltar('Ocorrencia', 'descricao',      'TEXT DEFAULT NULL AFTER tipo_ocorrencia');
CALL _add_coluna_se_faltar('Ocorrencia', 'arquivo',        'VARCHAR(255) DEFAULT NULL AFTER descricao');
CALL _add_coluna_se_faltar('Ocorrencia', 'resposta_gestao', 'TEXT DEFAULT NULL AFTER motivo_rejeicao');
CALL _add_coluna_se_faltar('Ocorrencia', 'hora_saida',     'TIME DEFAULT NULL AFTER data_fim_oc');
CALL _add_coluna_se_faltar('Ocorrencia', 'quem_busca',     'VARCHAR(150) DEFAULT NULL AFTER hora_saida');
CALL _add_coluna_se_faltar('Ocorrencia', 'saida_confirmada', 'BOOLEAN NOT NULL DEFAULT FALSE AFTER registrado');
CALL _add_coluna_se_faltar('Ocorrencia', 'data_saida_confirmada', 'DATETIME DEFAULT NULL AFTER saida_confirmada');

CALL _add_indice_se_faltar('Ocorrencia', 'idx_ocorrencia_categoria', 'categoria');
CALL _add_indice_se_faltar('Ocorrencia', 'idx_ocorrencia_registrado', 'registrado');

-- ------------------------------------------------------------
-- 4) Novas tabelas de identidade: Administrador, Coordenador, Porteiro
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS Administrador (
    id_administrador INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED NOT NULL UNIQUE,
    nome             VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_administrador),
    CONSTRAINT fk_admin_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Coordenador (
    id_coordenador INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario     INT UNSIGNED NOT NULL UNIQUE,
    nome           VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_coordenador),
    CONSTRAINT fk_coord_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS Porteiro (
    id_porteiro INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario  INT UNSIGNED NOT NULL UNIQUE,
    nome        VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_porteiro),
    CONSTRAINT fk_porteiro_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5) Dá nome aos usuários de teste que já existem (gestão e
--    portaria) e garante a conta de administrador de teste.
--    Tudo aqui é seguro de repetir: só cria o que ainda não existe.
-- ------------------------------------------------------------
INSERT INTO Coordenador (id_usuario, nome)
SELECT id_usuario, 'Coordenação Teste'
FROM Usuario WHERE email = 'gestao@integra.com'
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

INSERT INTO Porteiro (id_usuario, nome)
SELECT id_usuario, 'Portaria Teste'
FROM Usuario WHERE email = 'porteiro@integra.com'
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- Conta de administrador de teste (senha: 123456, salva com hash).
-- Para criar um administrador "de verdade", use o script
-- criar_administrador.py, que já gera a senha com hash.
INSERT INTO Usuario (email, senha, nivel_acesso)
VALUES ('admin@integra.com', 'scrypt:32768:8:1$TYoUlT1F0nSgLNs8$6cf9d99f958735bdc49a825636946b428f5aa81c2e0b56615c965be2b442055e4674e9551fa03dd37e4be5c5d41598f4ed39847cbdb90523fb5a352043512e3b', 5)
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO Administrador (id_usuario, nome)
SELECT id_usuario, 'Administrador(a) Teste'
FROM Usuario WHERE email = 'admin@integra.com'
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- Professor padrão (usado como responsável pela ocorrência quando o
-- front ainda não deixa escolher qual professor recebe a solicitação).
INSERT INTO Usuario (email, senha, telefone, nivel_acesso)
VALUES ('professor@integra.com', 'scrypt:32768:8:1$TYoUlT1F0nSgLNs8$6cf9d99f958735bdc49a825636946b428f5aa81c2e0b56615c965be2b442055e4674e9551fa03dd37e4be5c5d41598f4ed39847cbdb90523fb5a352043512e3b', NULL, 2)
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO Professor (id_usuario, nome)
SELECT id_usuario, 'Professor Padrão'
FROM Usuario
WHERE email = 'professor@integra.com'
AND NOT EXISTS (SELECT 1 FROM Professor WHERE nome = 'Professor Padrão');

DROP PROCEDURE IF EXISTS _add_coluna_se_faltar;
DROP PROCEDURE IF EXISTS _add_indice_se_faltar;

-- Conferência rápida
SELECT id_usuario, email, nivel_acesso, ativo FROM Usuario;
SELECT * FROM Administrador;
SELECT * FROM Coordenador;
SELECT * FROM Porteiro;
