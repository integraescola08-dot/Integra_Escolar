"""Validações compartilhadas entre routes/auth.py e routes/admin.py.

Centralizado aqui para não duplicar a mesma regra em mais de um arquivo
(REGRA 6 do projeto: não criar código duplicado se já existir função
equivalente).
"""
import re

# Letras (incluindo acentos comuns do português), espaço, hífen e apóstrofo.
# Exige nome e sobrenome (pelo menos duas "palavras") e bloqueia entradas
# compostas só por números ou por caracteres inválidos.
_NOME_PALAVRA = r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:['\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*"
NOME_REGEX = re.compile(rf"^{_NOME_PALAVRA}(?:\s+{_NOME_PALAVRA})+$")


def nome_valido(nome: str) -> bool:
    """True se `nome` parece um nome de pessoa: nome e sobrenome, contendo
    apenas letras, espaços, hífen e apóstrofo (ex.: "João da Silva",
    "Ana Júlia Souza", "D'Ávila Costa")."""
    nome = (nome or '').strip()
    if not (3 <= len(nome) <= 150):
        return False
    return bool(NOME_REGEX.match(nome))


MENSAGEM_NOME_INVALIDO = (
    'Informe um nome válido, com nome e sobrenome '
    '(apenas letras, espaços, hífen ou apóstrofo).'
)
