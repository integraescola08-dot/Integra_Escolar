import os
from datetime import date, datetime, time, timedelta
from decimal import Decimal

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

# Lê o arquivo .env que fica na raiz do projeto.
load_dotenv()


def _json_safe_value(value):
    """Converte tipos do MySQL/Python para valores que o Flask consegue enviar em JSON."""
    if isinstance(value, timedelta):
        total_seconds = int(value.total_seconds())
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, time):
        return value.strftime("%H:%M:%S")
    if isinstance(value, Decimal):
        return float(value)
    return value


def json_safe(row):
    """Converte dict/list vindos do banco para JSON seguro."""
    if row is None:
        return None
    if isinstance(row, list):
        return [json_safe(item) for item in row]
    if isinstance(row, dict):
        return {key: _json_safe_value(value) for key, value in row.items()}
    return _json_safe_value(row)


def get_connection():
    try:
        return mysql.connector.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'integra_escolar'),
            port=int(os.getenv('DB_PORT', '3306')),
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci'
        )
    except Error as error:
        print('Erro ao conectar ao MySQL:', error)
        raise


def fetch_one(sql, params=None):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params or ())
        row = cur.fetchone()
        return json_safe(row)
    finally:
        cur.close()
        conn.close()


def fetch_all(sql, params=None):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params or ())
        rows = cur.fetchall()
        return json_safe(rows)
    finally:
        cur.close()
        conn.close()


def execute(sql, params=None):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql, params or ())
        conn.commit()
        return cur.lastrowid
    finally:
        cur.close()
        conn.close()
