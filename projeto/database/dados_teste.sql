USE integra_escolar;

INSERT INTO Turma (codigo, descricao) VALUES
('3TDSA', '3º TDS A'),
('3TDSB', '3º TDS B'),
('3MKTB', '3º MKT B')
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);

INSERT INTO Usuario (email, senha, telefone, nivel_acesso) VALUES
('responsavel@integra.com', '123456', '81999999999', 1),
('gestao@integra.com', '123456', NULL, 3),
('porteiro@integra.com', '123456', NULL, 4)
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO Responsavel (id_usuario, cpf, nome, telefone)
SELECT id_usuario, '12345678901', 'Responsável Teste', '81999999999'
FROM Usuario WHERE email='responsavel@integra.com'
ON DUPLICATE KEY UPDATE nome=VALUES(nome);

INSERT INTO Aluno (nome, turma, id_responsavel)
SELECT 'Camilla Rayssa', '3TDSA', r.id_responsavel FROM Responsavel r WHERE r.cpf='12345678901'
LIMIT 1;
