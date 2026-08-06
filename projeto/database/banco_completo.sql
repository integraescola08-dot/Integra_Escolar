-- ============================================================
--  Integra Escolar — Banco completo para teste Flask + MySQL
--  Este script APAGA e RECRIA o banco integra_escolar.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS integra_escolar;
SET FOREIGN_KEY_CHECKS = 1;

CREATE DATABASE integra_escolar
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE integra_escolar;
SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- Tabela: Turma
-- ------------------------------------------------------------
CREATE TABLE Turma (
    codigo      CHAR(10)     NOT NULL,
    descricao   VARCHAR(100),
    PRIMARY KEY (codigo)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela: Usuario
-- nivel_acesso: 1=Responsavel | 2=Professor | 3=Gestao/Admin | 4=Porteiro
-- ------------------------------------------------------------
CREATE TABLE Usuario (
    id_usuario   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    email        VARCHAR(150)  NOT NULL UNIQUE,
    senha        VARCHAR(255)  NOT NULL,
    telefone     CHAR(11),
    nivel_acesso TINYINT       NOT NULL DEFAULT 1,
    PRIMARY KEY (id_usuario),
    CONSTRAINT chk_usuario_telefone
        CHECK (telefone IS NULL OR (telefone REGEXP '^[0-9]{10,11}$')),
    CONSTRAINT chk_usuario_nivel
        CHECK (nivel_acesso IN (1, 2, 3, 4))
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela: Responsavel
-- ------------------------------------------------------------
CREATE TABLE Responsavel (
    id_responsavel INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_usuario     INT UNSIGNED  NOT NULL,
    cpf            CHAR(11)      NOT NULL UNIQUE,
    nome           VARCHAR(150)  NOT NULL,
    telefone       CHAR(11),
    primeiro_login BOOLEAN       NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_responsavel),
    CONSTRAINT chk_resp_cpf
        CHECK (cpf REGEXP '^[0-9]{11}$'),
    CONSTRAINT chk_resp_telefone
        CHECK (telefone IS NULL OR (telefone REGEXP '^[0-9]{10,11}$')),
    CONSTRAINT fk_resp_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela: Aluno
-- ------------------------------------------------------------
CREATE TABLE Aluno (
    matricula      INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    nome           VARCHAR(150)  NOT NULL,
    turma          CHAR(10)      NOT NULL,
    id_responsavel INT UNSIGNED  NOT NULL,
    PRIMARY KEY (matricula),
    CONSTRAINT fk_aluno_turma FOREIGN KEY (turma)
        REFERENCES Turma (codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aluno_responsavel FOREIGN KEY (id_responsavel)
        REFERENCES Responsavel (id_responsavel)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela: Professor
-- ------------------------------------------------------------
CREATE TABLE Professor (
    matricula  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    id_usuario INT UNSIGNED  NOT NULL,
    nome       VARCHAR(150)  NOT NULL,
    PRIMARY KEY (matricula),
    CONSTRAINT fk_prof_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela: Horario
-- ------------------------------------------------------------
CREATE TABLE Horario (
    id_horario           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    matricula_professor  INT UNSIGNED  NOT NULL,
    turma                CHAR(10)      NOT NULL,
    materia              VARCHAR(80)   NOT NULL,
    dia_da_semana        ENUM('Segunda','Terca','Quarta','Quinta','Sexta','Sabado','Domingo') NOT NULL,
    hr_inicio            TIME          NOT NULL,
    hr_final             TIME          NOT NULL,
    data_inicio_vigencia DATE          NOT NULL,
    data_fim_vigencia    DATE          DEFAULT NULL,
    data_registro        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_cadastro  INT UNSIGNED  NOT NULL,
    PRIMARY KEY (id_horario),
    CONSTRAINT chk_horario_horas
        CHECK (hr_final > hr_inicio),
    CONSTRAINT chk_horario_vigencia
        CHECK (data_fim_vigencia IS NULL OR data_fim_vigencia > data_inicio_vigencia),
    CONSTRAINT fk_horario_turma FOREIGN KEY (turma)
        REFERENCES Turma (codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_horario_professor FOREIGN KEY (matricula_professor)
        REFERENCES Professor (matricula)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_horario_usuario FOREIGN KEY (id_usuario_cadastro)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela: Ocorrencia
-- Já inclui campos extras usados pelo front: atestado, liberação, arquivo,
-- resposta da gestão e confirmação de saída.
-- ------------------------------------------------------------
CREATE TABLE Ocorrencia (
    id_ocorrencia        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    categoria            ENUM('Atestado','Liberacao','Falta','Atraso','Outro') NOT NULL DEFAULT 'Outro',
    tipo_ocorrencia      ENUM('Falta','Atraso','Comportamento','Saida Antecipada','Outro') NOT NULL,
    descricao            TEXT          DEFAULT NULL,
    arquivo              VARCHAR(255)  DEFAULT NULL,
    data_da_criacao      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_inicio_oc       DATE          DEFAULT NULL,
    data_fim_oc          DATE          DEFAULT NULL,
    hora_saida           TIME          DEFAULT NULL,
    quem_busca           VARCHAR(150)  DEFAULT NULL,
    motivo_rejeicao      TEXT          DEFAULT NULL,
    resposta_gestao      TEXT          DEFAULT NULL,
    registrado           BOOLEAN       NOT NULL DEFAULT FALSE,
    saida_confirmada     BOOLEAN       NOT NULL DEFAULT FALSE,
    data_saida_confirmada DATETIME     DEFAULT NULL,
    id_responsavel       INT UNSIGNED  NOT NULL,
    matricula_professor  INT UNSIGNED  NOT NULL,
    id_usuario_aprovador INT UNSIGNED  DEFAULT NULL,
    PRIMARY KEY (id_ocorrencia),
    CONSTRAINT chk_oc_datas
        CHECK (data_fim_oc IS NULL OR data_inicio_oc IS NULL OR data_fim_oc >= data_inicio_oc),
    CONSTRAINT chk_oc_rejeicao
        CHECK (registrado = TRUE OR motivo_rejeicao IS NULL OR LENGTH(motivo_rejeicao) > 0),
    CONSTRAINT fk_oc_responsavel FOREIGN KEY (id_responsavel)
        REFERENCES Responsavel (id_responsavel)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_oc_professor FOREIGN KEY (matricula_professor)
        REFERENCES Professor (matricula)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_oc_aprovador FOREIGN KEY (id_usuario_aprovador)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabela associativa: Ocorrencia <-> Aluno
-- ------------------------------------------------------------
CREATE TABLE Ocorrencia_Aluno (
    id_ocorrencia INT UNSIGNED  NOT NULL,
    matricula     INT UNSIGNED  NOT NULL,
    PRIMARY KEY (id_ocorrencia, matricula),
    CONSTRAINT fk_oa_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES Ocorrencia (id_ocorrencia)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oa_aluno FOREIGN KEY (matricula)
        REFERENCES Aluno (matricula)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- Índices auxiliares
-- ============================================================
CREATE INDEX idx_aluno_turma            ON Aluno      (turma);
CREATE INDEX idx_horario_turma          ON Horario    (turma);
CREATE INDEX idx_horario_dia            ON Horario    (dia_da_semana);
CREATE INDEX idx_ocorrencia_tipo        ON Ocorrencia (tipo_ocorrencia);
CREATE INDEX idx_ocorrencia_categoria   ON Ocorrencia (categoria);
CREATE INDEX idx_ocorrencia_registrado  ON Ocorrencia (registrado);
CREATE INDEX idx_ocorrencia_criacao     ON Ocorrencia (data_da_criacao);
CREATE INDEX idx_ocorrencia_responsavel ON Ocorrencia (id_responsavel);
CREATE INDEX idx_ocorrencia_professor   ON Ocorrencia (matricula_professor);

-- ============================================================
-- Dados de teste
-- Senha de todos: 123456
-- ============================================================
INSERT INTO Turma (codigo, descricao) VALUES
('3TDSA', '3º TDS A'),
('3TDSB', '3º TDS B'),
('3MKTB', '3º MKT B');

INSERT INTO Usuario (email, senha, telefone, nivel_acesso) VALUES
('responsavel@integra.com', '123456', '81999999999', 1),
('professor@integra.com',   '123456', NULL,          2),
('gestao@integra.com',      '123456', NULL,          3),
('porteiro@integra.com',    '123456', NULL,          4);

INSERT INTO Responsavel (id_usuario, cpf, nome, telefone)
SELECT id_usuario, '12345678901', 'Responsável Teste', '81999999999'
FROM Usuario WHERE email = 'responsavel@integra.com';

INSERT INTO Professor (id_usuario, nome)
SELECT id_usuario, 'Professor Padrão'
FROM Usuario WHERE email = 'professor@integra.com';

INSERT INTO Aluno (nome, turma, id_responsavel)
SELECT 'Camilla Rayssa', '3TDSA', id_responsavel
FROM Responsavel WHERE cpf = '12345678901';

INSERT INTO Aluno (nome, turma, id_responsavel)
SELECT 'Pedro Henrique', '3TDSA', id_responsavel
FROM Responsavel WHERE cpf = '12345678901';

-- Horários de teste
INSERT INTO Horario (matricula_professor, turma, materia, dia_da_semana, hr_inicio, hr_final, data_inicio_vigencia, id_usuario_cadastro)
SELECT p.matricula, '3TDSA', 'Matemática', 'Segunda', '07:30:00', '08:20:00', CURDATE(), u.id_usuario
FROM Professor p
JOIN Usuario u ON u.email = 'gestao@integra.com'
WHERE p.nome = 'Professor Padrão';

-- Conferência rápida
SELECT id_usuario, email, senha, nivel_acesso FROM Usuario;
SELECT * FROM Turma;
SELECT matricula, nome, turma, id_responsavel FROM Aluno;
