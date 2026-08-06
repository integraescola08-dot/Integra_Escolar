USE integra_escolar;

-- IMPORTANTE: rode este arquivo depois do seu script original.
-- Ajuste 1: o front tem porteiro. Então o nível 4 precisa existir.
ALTER TABLE Usuario DROP CHECK chk_usuario_nivel;
ALTER TABLE Usuario
  ADD CONSTRAINT chk_usuario_nivel CHECK (nivel_acesso IN (1, 2, 3, 4));
-- 1=Responsavel | 2=Professor | 3=Gestao/Admin | 4=Porteiro

-- Ajuste 2: a tabela Ocorrencia precisa diferenciar atestado de liberação.
ALTER TABLE Ocorrencia
  ADD COLUMN categoria ENUM('Atestado','Liberacao','Falta','Atraso','Outro') NOT NULL DEFAULT 'Outro' AFTER id_ocorrencia,
  ADD COLUMN descricao TEXT DEFAULT NULL AFTER tipo_ocorrencia,
  ADD COLUMN arquivo VARCHAR(255) DEFAULT NULL AFTER descricao,
  ADD COLUMN resposta_gestao TEXT DEFAULT NULL AFTER motivo_rejeicao,
  ADD COLUMN hora_saida TIME DEFAULT NULL AFTER data_fim_oc,
  ADD COLUMN quem_busca VARCHAR(150) DEFAULT NULL AFTER hora_saida,
  ADD COLUMN saida_confirmada BOOLEAN NOT NULL DEFAULT FALSE AFTER registrado,
  ADD COLUMN data_saida_confirmada DATETIME DEFAULT NULL AFTER saida_confirmada;

CREATE INDEX idx_ocorrencia_categoria ON Ocorrencia (categoria);
CREATE INDEX idx_ocorrencia_registrado ON Ocorrencia (registrado);

-- Professor padrão para receber solicitações enquanto o front não escolhe professor.
INSERT INTO Usuario (email, senha, telefone, nivel_acesso)
VALUES ('professor@integra.com', '123456', NULL, 2)
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO Professor (id_usuario, nome)
SELECT id_usuario, 'Professor Padrão'
FROM Usuario
WHERE email = 'professor@integra.com'
AND NOT EXISTS (SELECT 1 FROM Professor WHERE nome = 'Professor Padrão');
