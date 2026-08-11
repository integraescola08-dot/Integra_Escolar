-- ============================================================
-- Integra Escolar — Banco oficial V6
-- ATENÇÃO: este script APAGA e RECRIA o banco integra_escolar.
-- Não contém dados de teste.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS integra_escolar;
SET FOREIGN_KEY_CHECKS = 1;

CREATE DATABASE integra_escolar
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE integra_escolar;
SET NAMES utf8mb4;

CREATE TABLE Turma (
    codigo       CHAR(10) NOT NULL,
    criado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (codigo)
) ENGINE=InnoDB;

CREATE TABLE Usuario (
    id_usuario        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email             VARCHAR(150) NOT NULL UNIQUE,
    senha             VARCHAR(255) NOT NULL,
    telefone          CHAR(11),
    nivel_acesso      TINYINT NOT NULL,
    ativo             BOOLEAN NOT NULL DEFAULT TRUE,
    email_verificado  BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario),
    CONSTRAINT chk_usuario_telefone
        CHECK (telefone IS NULL OR telefone REGEXP '^[0-9]{10,11}$'),
    CONSTRAINT chk_usuario_nivel
        CHECK (nivel_acesso IN (1, 2, 3, 4, 5))
) ENGINE=InnoDB;

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

CREATE TABLE Responsavel (
    id_responsavel INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario     INT UNSIGNED NOT NULL UNIQUE,
    cpf            CHAR(11) NOT NULL UNIQUE,
    nome           VARCHAR(150) NOT NULL,
    telefone       CHAR(11),
    primeiro_login BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_responsavel),
    CONSTRAINT chk_resp_cpf CHECK (cpf REGEXP '^[0-9]{11}$'),
    CONSTRAINT chk_resp_telefone
        CHECK (telefone IS NULL OR telefone REGEXP '^[0-9]{10,11}$'),
    CONSTRAINT fk_resp_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Aluno (
    matricula       CHAR(12) NOT NULL,
    nome            VARCHAR(150) NOT NULL,
    turma           CHAR(10) NOT NULL,
    id_responsavel  INT UNSIGNED NULL,
    ativo           BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (matricula),
    CONSTRAINT chk_aluno_matricula CHECK (matricula REGEXP '^[0-9]{12}$'),
    CONSTRAINT fk_aluno_turma FOREIGN KEY (turma)
        REFERENCES Turma (codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_aluno_responsavel FOREIGN KEY (id_responsavel)
        REFERENCES Responsavel (id_responsavel)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Materia (
    id_materia INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome       VARCHAR(100) NOT NULL,
    ativo      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id_materia),
    UNIQUE KEY uq_materia_nome (nome)
) ENGINE=InnoDB;

CREATE TABLE Professor (
    matricula  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_usuario INT UNSIGNED NOT NULL UNIQUE,
    nome       VARCHAR(150) NOT NULL,
    PRIMARY KEY (matricula),
    CONSTRAINT fk_prof_usuario FOREIGN KEY (id_usuario)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Professor_Materia (
    matricula_professor INT UNSIGNED NOT NULL,
    id_materia          INT UNSIGNED NOT NULL,
    PRIMARY KEY (matricula_professor, id_materia),
    CONSTRAINT fk_pm_professor FOREIGN KEY (matricula_professor)
        REFERENCES Professor (matricula)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_pm_materia FOREIGN KEY (id_materia)
        REFERENCES Materia (id_materia)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Horario (
    id_horario           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    turma                CHAR(10) NOT NULL,
    id_materia           INT UNSIGNED NOT NULL,
    matricula_professor  INT UNSIGNED DEFAULT NULL,
    dia_da_semana        ENUM('Segunda','Terca','Quarta','Quinta','Sexta','Sabado','Domingo') NOT NULL,
    hr_inicio            TIME NOT NULL,
    hr_final             TIME NOT NULL,
    data_inicio_vigencia DATE NOT NULL,
    data_fim_vigencia    DATE DEFAULT NULL,
    data_registro        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario_cadastro  INT UNSIGNED NOT NULL,
    PRIMARY KEY (id_horario),
    CONSTRAINT chk_horario_horas CHECK (hr_final > hr_inicio),
    CONSTRAINT chk_horario_vigencia
        CHECK (data_fim_vigencia IS NULL OR data_fim_vigencia >= data_inicio_vigencia),
    CONSTRAINT uq_horario_slot UNIQUE (turma, dia_da_semana, hr_inicio, data_inicio_vigencia),
    CONSTRAINT fk_horario_turma FOREIGN KEY (turma)
        REFERENCES Turma (codigo)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_horario_materia FOREIGN KEY (id_materia)
        REFERENCES Materia (id_materia)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_horario_professor FOREIGN KEY (matricula_professor)
        REFERENCES Professor (matricula)
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_horario_usuario FOREIGN KEY (id_usuario_cadastro)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE Ocorrencia (
    id_ocorrencia         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    categoria             ENUM('Atestado','Liberacao','Falta','Atraso','Outro') NOT NULL DEFAULT 'Outro',
    tipo_ocorrencia       ENUM('Falta','Atraso','Comportamento','Saida Antecipada','Outro') NOT NULL,
    descricao             TEXT DEFAULT NULL,
    arquivo               VARCHAR(255) DEFAULT NULL,
    data_da_criacao       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_inicio_oc        DATE DEFAULT NULL,
    data_fim_oc           DATE DEFAULT NULL,
    hora_saida            TIME DEFAULT NULL,
    quem_busca            VARCHAR(150) DEFAULT NULL,
    motivo_rejeicao       TEXT DEFAULT NULL,
    resposta_gestao       TEXT DEFAULT NULL,
    registrado            BOOLEAN NOT NULL DEFAULT FALSE,
    saida_confirmada      BOOLEAN NOT NULL DEFAULT FALSE,
    data_saida_confirmada DATETIME DEFAULT NULL,
    id_responsavel        INT UNSIGNED DEFAULT NULL,
    matricula_professor   INT UNSIGNED DEFAULT NULL,
    id_usuario_aprovador  INT UNSIGNED DEFAULT NULL,
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
        ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT fk_oc_aprovador FOREIGN KEY (id_usuario_aprovador)
        REFERENCES Usuario (id_usuario)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Ocorrencia_Aluno (
    id_ocorrencia INT UNSIGNED NOT NULL,
    matricula     CHAR(12) NOT NULL,
    PRIMARY KEY (id_ocorrencia, matricula),
    CONSTRAINT fk_oa_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES Ocorrencia (id_ocorrencia)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oa_aluno FOREIGN KEY (matricula)
        REFERENCES Aluno (matricula)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB;

-- Uma ocorrência aprovada pode afetar várias aulas e, portanto, vários professores.
-- Esta tabela é a fila/histórico da tela do professor.
CREATE TABLE Ocorrencia_Aula (
    id_ocorrencia_aula  INT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_ocorrencia       INT UNSIGNED NOT NULL,
    id_horario          INT UNSIGNED NOT NULL,
    matricula_professor INT UNSIGNED NOT NULL,
    data_aula           DATE NOT NULL,
    status_professor    ENUM('Pendente','Falta Lancada','Falta Nao Lancada') NOT NULL DEFAULT 'Pendente',
    respondido_em       DATETIME DEFAULT NULL,
    observacao_professor VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (id_ocorrencia_aula),
    UNIQUE KEY uq_ocorrencia_aula (id_ocorrencia, id_horario, data_aula),
    CONSTRAINT fk_oca_ocorrencia FOREIGN KEY (id_ocorrencia)
        REFERENCES Ocorrencia (id_ocorrencia)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_oca_horario FOREIGN KEY (id_horario)
        REFERENCES Horario (id_horario)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_oca_professor FOREIGN KEY (matricula_professor)
        REFERENCES Professor (matricula)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE INDEX idx_usuario_nivel          ON Usuario    (nivel_acesso);
CREATE INDEX idx_usuario_ativo          ON Usuario    (ativo);
CREATE INDEX idx_aluno_turma            ON Aluno      (turma);
CREATE INDEX idx_aluno_responsavel      ON Aluno      (id_responsavel);
CREATE INDEX idx_pm_materia             ON Professor_Materia (id_materia);
CREATE INDEX idx_horario_professor      ON Horario    (matricula_professor);
CREATE INDEX idx_horario_turma          ON Horario    (turma);
CREATE INDEX idx_horario_materia        ON Horario    (id_materia);
CREATE INDEX idx_horario_dia            ON Horario    (dia_da_semana);
CREATE INDEX idx_ocorrencia_categoria   ON Ocorrencia (categoria);
CREATE INDEX idx_ocorrencia_registrado  ON Ocorrencia (registrado);
CREATE INDEX idx_ocorrencia_criacao     ON Ocorrencia (data_da_criacao);
CREATE INDEX idx_ocorrencia_responsavel ON Ocorrencia (id_responsavel);
CREATE INDEX idx_oca_professor_status   ON Ocorrencia_Aula (matricula_professor, status_professor);
CREATE INDEX idx_oca_data               ON Ocorrencia_Aula (data_aula);
