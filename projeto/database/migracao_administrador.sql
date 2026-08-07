-- ============================================================
--  Integra Escolar — Migração: integrando o que a "versão 3"
--  trouxe de novo (sistema de Administrador) ao NOSSO banco.
--
--  Este script NÃO apaga nada — só adiciona. Rode ele em cima
--  do banco que você já tem (integra_escolar), depois do
--  banco_completo.sql e do dados_teste.sql.
-- ============================================================

USE integra_escolar;

-- ------------------------------------------------------------
-- 1) Usuario: colunas de auditoria/soft-delete + nível 5 (admin)
-- ------------------------------------------------------------
ALTER TABLE Usuario
    ADD COLUMN ativo            BOOLEAN  NOT NULL DEFAULT TRUE  AFTER nivel_acesso,
    ADD COLUMN email_verificado BOOLEAN  NOT NULL DEFAULT FALSE AFTER ativo,
    ADD COLUMN criado_em        DATETIME DEFAULT CURRENT_TIMESTAMP AFTER email_verificado,
    ADD COLUMN atualizado_em    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER criado_em;

ALTER TABLE Usuario DROP CHECK chk_usuario_nivel;
ALTER TABLE Usuario ADD CONSTRAINT chk_usuario_nivel CHECK (nivel_acesso IN (1, 2, 3, 4, 5));

-- ------------------------------------------------------------
-- 2) Aluno: colunas de auditoria + responsável passa a ser opcional
--    (necessário para o fluxo de auto-cadastro: a gestão cadastra
--    o aluno primeiro, o responsável se vincula depois pelo cadastro.html)
-- ------------------------------------------------------------
ALTER TABLE Aluno
    ADD COLUMN ativo            BOOLEAN  NOT NULL DEFAULT TRUE  AFTER id_responsavel,
    ADD COLUMN email_verificado BOOLEAN  NOT NULL DEFAULT FALSE AFTER ativo,
    ADD COLUMN criado_em        DATETIME DEFAULT CURRENT_TIMESTAMP AFTER email_verificado;

ALTER TABLE Aluno MODIFY COLUMN id_responsavel INT UNSIGNED NULL;

-- ------------------------------------------------------------
-- 3) Novas tabelas de identidade: Administrador, Coordenador, Porteiro
--    (mesmo padrão de Professor: id_usuario + nome)
-- ------------------------------------------------------------
CREATE TABLE Administrador (
    id_administrador INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario       INT UNSIGNED NOT NULL UNIQUE,
    nome             VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_administrador),
    CONSTRAINT fk_admin_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Coordenador (
    id_coordenador INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario     INT UNSIGNED NOT NULL UNIQUE,
    nome           VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_coordenador),
    CONSTRAINT fk_coord_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Porteiro (
    id_porteiro INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario  INT UNSIGNED NOT NULL UNIQUE,
    nome        VARCHAR(150) NOT NULL,
    PRIMARY KEY (id_porteiro),
    CONSTRAINT fk_porteiro_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4) Dar nome aos usuários de teste que já existem (gestão e
--    portaria), já que agora eles têm uma tabela própria de
--    identidade — sem isso, ficariam sem "pessoa" no login.
-- ------------------------------------------------------------
INSERT INTO Coordenador (id_usuario, nome)
SELECT id_usuario, 'Coordenação Teste'
FROM Usuario WHERE email = 'gestao@integra.com'
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

INSERT INTO Porteiro (id_usuario, nome)
SELECT id_usuario, 'Portaria Teste'
FROM Usuario WHERE email = 'porteiro@integra.com'
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- Conta de administrador de teste (senha: 123456, salva com hash — igual
-- às outras contas de teste; o login não aceita mais texto puro).
-- Para criar um administrador "de verdade" mais pra frente, use o
-- script criar_administrador.py, que já gera a senha com hash.
INSERT INTO Usuario (email, senha, nivel_acesso)
VALUES ('admin@integra.com', 'scrypt:32768:8:1$TYoUlT1F0nSgLNs8$6cf9d99f958735bdc49a825636946b428f5aa81c2e0b56615c965be2b442055e4674e9551fa03dd37e4be5c5d41598f4ed39847cbdb90523fb5a352043512e3b', 5)
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO Administrador (id_usuario, nome)
SELECT id_usuario, 'Administrador(a) Teste'
FROM Usuario WHERE email = 'admin@integra.com'
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- Conferência rápida
SELECT id_usuario, email, nivel_acesso, ativo FROM Usuario;
SELECT * FROM Administrador;
SELECT * FROM Coordenador;
SELECT * FROM Porteiro;
