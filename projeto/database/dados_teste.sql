USE integra_escolar;

INSERT INTO Turma (codigo, descricao) VALUES
('3TDSA', '3º TDS A'),
('3TDSB', '3º TDS B'),
('3MKTB', '3º MKT B')
ON DUPLICATE KEY UPDATE descricao = VALUES(descricao);

-- Senha de todos os usuários de teste abaixo: 123456
-- (hash gerado com werkzeug.security.generate_password_hash — o login
-- agora exige senha com hash, não aceita mais texto puro)
INSERT INTO Usuario (email, senha, telefone, nivel_acesso) VALUES
('responsavel@integra.com', 'scrypt:32768:8:1$Rsg0RiHI5mqIv1EA$0c12baf2933051adf15e9c4c06a9b0f8d77a33f4d90fc41468e576ae8f48b7ea27fb4d79ba2b95aee1890862941ce4e485ead202b095eede8c6d1771fed64f0d', '81999999999', 1),
('gestao@integra.com', 'scrypt:32768:8:1$Rsg0RiHI5mqIv1EA$0c12baf2933051adf15e9c4c06a9b0f8d77a33f4d90fc41468e576ae8f48b7ea27fb4d79ba2b95aee1890862941ce4e485ead202b095eede8c6d1771fed64f0d', NULL, 3),
('porteiro@integra.com', 'scrypt:32768:8:1$Rsg0RiHI5mqIv1EA$0c12baf2933051adf15e9c4c06a9b0f8d77a33f4d90fc41468e576ae8f48b7ea27fb4d79ba2b95aee1890862941ce4e485ead202b095eede8c6d1771fed64f0d', NULL, 4)
ON DUPLICATE KEY UPDATE email=email;

INSERT INTO Responsavel (id_usuario, cpf, nome, telefone)
SELECT id_usuario, '12345678901', 'Responsável Teste', '81999999999'
FROM Usuario WHERE email='responsavel@integra.com'
ON DUPLICATE KEY UPDATE nome=VALUES(nome);

INSERT INTO Aluno (nome, turma, id_responsavel)
SELECT 'Camilla Rayssa', '3TDSA', r.id_responsavel FROM Responsavel r WHERE r.cpf='12345678901'
LIMIT 1;
