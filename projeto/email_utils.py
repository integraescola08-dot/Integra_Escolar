"""
Integra Escolar — Notificações por e-mail
================================================
Centraliza o envio de e-mail para os eventos do fluxo (atestado enviado,
liberação solicitada, decisão da gestão/professor, saída confirmada).

Configuração (adicione no .env):

    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=seuemail@gmail.com
    SMTP_PASSWORD=senha_de_app_do_gmail   # não é a senha normal da conta
    SMTP_FROM_NOME=Integra Escolar

Se você usar Gmail: a conta precisa ter verificação em 2 etapas ativada e
você deve gerar uma "senha de app" em myaccount.google.com/apppasswords —
a senha normal da conta NÃO funciona para SMTP.

O envio roda em uma thread separada (fire-and-forget) para não travar a
resposta da API esperando o servidor de e-mail. Se o envio falhar (SMTP mal
configurado, sem internet, etc.), o erro só é impresso no console — nunca
derruba a requisição que disparou a notificação.
"""

import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from db import fetch_all

SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
SMTP_FROM_NOME = os.getenv('SMTP_FROM_NOME', 'Integra Escolar')

EMAIL_ATIVO = bool(SMTP_HOST and SMTP_USER and SMTP_PASSWORD)

if not EMAIL_ATIVO:
    print('[email_utils] SMTP não configurado no .env — notificações por '
          'e-mail ficarão só no console (modo desenvolvimento).')


def _template(titulo: str, linhas: list[str]) -> str:
    """Monta um e-mail HTML simples, no mesmo tom visual do resto do sistema."""
    corpo_linhas = ''.join(f'<p style="margin:0 0 10px;color:#333;font-size:15px">{l}</p>' for l in linhas)
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;
                border:1px solid #e2e2e2;border-radius:10px;overflow:hidden">
      <div style="background:#1f4e79;padding:16px 24px">
        <span style="color:#fff;font-size:18px;font-weight:bold">Integra Escolar</span>
      </div>
      <div style="padding:24px">
        <h2 style="margin:0 0 16px;color:#1f4e79;font-size:18px">{titulo}</h2>
        {corpo_linhas}
      </div>
      <div style="background:#f5f5f5;padding:12px 24px;font-size:12px;color:#888">
        Notificação automática — não responda este e-mail.
      </div>
    </div>
    """


def _enviar_smtp(destinatario: str, assunto: str, corpo_html: str):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = assunto
    msg['From'] = f'{SMTP_FROM_NOME} <{SMTP_USER}>'
    msg['To'] = destinatario
    msg.attach(MIMEText(corpo_html, 'html', 'utf-8'))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as servidor:
        servidor.starttls()
        servidor.login(SMTP_USER, SMTP_PASSWORD)
        servidor.sendmail(SMTP_USER, destinatario, msg.as_string())


def enviar_email(destinatario: str, assunto: str, titulo: str, linhas: list[str]):
    """Dispara o e-mail em background. Não bloqueia a rota que chamou."""
    if not destinatario:
        return
    corpo_html = _template(titulo, linhas)

    if not EMAIL_ATIVO:
        print(f'[email_utils] (SMTP desligado) Para: {destinatario} | Assunto: {assunto}')
        return

    def _tarefa():
        try:
            _enviar_smtp(destinatario, assunto, corpo_html)
        except Exception as erro:
            print(f'[email_utils] Falha ao enviar e-mail para {destinatario}: {erro}')

    threading.Thread(target=_tarefa, daemon=True).start()


def emails_da_gestao() -> list[str]:
    """E-mails de todos os usuários de Gestão/Coordenação (nivel_acesso = 3)."""
    linhas = fetch_all('SELECT email FROM Usuario WHERE nivel_acesso = 3')
    return [l['email'] for l in linhas]


def notificar_gestao(assunto: str, titulo: str, linhas: list[str]):
    for email in emails_da_gestao():
        enviar_email(email, assunto, titulo, linhas)
