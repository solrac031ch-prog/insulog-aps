#!/usr/bin/env python3
"""Actualiza precios/stock de medicamentos particulares desde Farmacia Popular Cerro Navia."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://farmaciapopularonline.cl"
SOURCE_URL = f"{BASE_URL}/consultor?farmacia=cerro%20navia"
SEARCH_URL = f"{BASE_URL}/Consultor/ObtenerMedicamentos"
OUTPUT = Path("data/farmacia-cerro-navia.json")
MIN_BASE_ROWS = 5
SEARCH_TERMS = ("metfor", "empa", "vilda")
HTTP_HEADERS = {
    "User-Agent": "InsulogAPS/1.0 (+https://solrac031ch-prog.github.io/insulog-aps/)",
    "Accept-Language": "es-CL,es;q=0.9",
}


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.lower().replace(",", ".")).strip()


def parse_number(value: str) -> int | None:
    digits = re.sub(r"[^0-9]", "", value or "")
    return int(digits) if digits else None


def key_for_header(header: str) -> str:
    h = normalize(header)
    aliases = {
        "medicamento": "product",
        "principio": "principle",
        "marca": "brand",
        "botica": "botica",
        "stock": "stock",
        "unidad": "unit",
        "valor referencial venta": "price",
        "valor referencial unidad": "unit_price",
        "laboratorio": "laboratory",
    }
    return aliases.get(h, h)


def parse_table(html: str) -> tuple[list[str], list[dict[str, str]]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if table is None:
        raise RuntimeError("No se encontró la tabla de medicamentos de Cerro Navia")

    headers = [key_for_header(th.get_text(" ", strip=True)) for th in table.select("thead th")]
    if not headers:
        first_row = table.find("tr")
        headers = [
            key_for_header(cell.get_text(" ", strip=True))
            for cell in first_row.find_all(["th", "td"])
        ] if first_row else []

    required_headers = {"product", "principle", "botica", "stock", "price"}
    missing_headers = sorted(required_headers.difference(headers))
    if missing_headers:
        raise RuntimeError(f"La tabla cambió de estructura; faltan columnas: {', '.join(missing_headers)}")

    rows: list[dict[str, str]] = []
    body_rows = table.select("tbody tr") or table.find_all("tr")[1:]
    for tr in body_rows:
        # En Cerro Navia la columna Botica viene como <th> dentro de cada fila.
        # Leer solo <td> desplaza stock/precio una columna y produce datos falsos.
        cells = [cell.get_text(" ", strip=True) for cell in tr.find_all(["td", "th"])]
        if not cells:
            continue
        row = {
            headers[i] if i < len(headers) else f"col_{i}": value
            for i, value in enumerate(cells)
        }
        rows.append(row)
    return headers, rows


def query_filtered_rows(session: requests.Session, texto: str) -> tuple[list[str], list[dict[str, str]]]:
    response = session.post(
        SEARCH_URL,
        data={"Texto": texto},
        timeout=45,
        headers={
            **HTTP_HEADERS,
            "Referer": SOURCE_URL,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json, text/javascript, */*; q=0.01",
        },
    )
    response.raise_for_status()
    try:
        result = response.json()
    except ValueError as exc:
        raise RuntimeError(f"El buscador no devolvió JSON para '{texto}'") from exc
    if result != "exito":
        raise RuntimeError(f"El buscador rechazó el filtro '{texto}': {result!r}")

    filtered = session.get(SOURCE_URL, timeout=45, headers=HTTP_HEADERS)
    filtered.raise_for_status()
    return parse_table(filtered.text)


def row_identity(row: dict[str, str]) -> tuple[str, ...]:
    return tuple(
        normalize(row.get(field, ""))
        for field in ("product", "principle", "brand", "botica", "stock", "price", "laboratory")
    )


def infer_variant(key: str, combined: str) -> str:
    text = normalize(combined).replace("1.000", "1000")
    if key == "empagliflozina":
        if re.search(r"\b10\s*mg\b", text):
            return "10"
        if re.search(r"\b25\s*mg\b", text):
            return "25"
    if key == "vildaMet":
        if (
            re.search(r"\b50\s*(?:mg)?\s*/\s*500\s*mg\b", text)
            or "50/500" in text
            or ("50 mg" in text and "500 mg" in text)
        ):
            return "50/500"
        if (
            re.search(r"\b50\s*(?:mg)?\s*/\s*850\s*mg\b", text)
            or "50/850" in text
            or ("50 mg" in text and "850 mg" in text)
        ):
            return "50/850"
        if (
            re.search(r"\b50\s*(?:mg)?\s*/\s*1000\s*mg\b", text)
            or "50/1000" in text
            or ("50 mg" in text and "1000 mg" in text)
        ):
            return "50/1000"
    if key == "empaMet12_5_1000":
        if "12.5/1000" in text or ("12.5 mg" in text and "1000 mg" in text):
            return "12.5/1000"
    return ""


def is_match(key: str, row: dict[str, str]) -> bool:
    product = normalize(row.get("product", ""))
    principle = normalize(row.get("principle", ""))
    combined = f"{product} {principle}"

    if key == "metformina500":
        return (
            "metformina" in principle
            and all(x not in principle for x in ("vildagliptina", "empagliflozina"))
            and bool(re.search(r"\b500\s*mg\b", combined))
        )
    if key == "metformina750":
        return (
            "metformina" in principle
            and all(x not in principle for x in ("vildagliptina", "empagliflozina"))
            and bool(re.search(r"\b750\s*mg\b", combined))
        )
    if key == "empagliflozina":
        return "empagliflozina" in principle and "metformina" not in principle
    if key == "empaMet12_5_1000":
        return (
            "empagliflozina" in combined
            and "metformina" in combined
            and infer_variant(key, combined) == "12.5/1000"
        )
    if key == "vildaMet":
        return "vildagliptina" in combined and "metformina" in combined
    return False


def to_match(key: str, row: dict[str, str]) -> dict:
    combined = f"{row.get('product', '')} {row.get('principle', '')}"
    return {
        "product": row.get("product", ""),
        "principle": row.get("principle", ""),
        "brand": row.get("brand", ""),
        "botica": row.get("botica", ""),
        "stock": parse_number(row.get("stock", "")),
        "unit": row.get("unit", ""),
        "price": parse_number(row.get("price", "")),
        "laboratory": row.get("laboratory", ""),
        "variant": infer_variant(key, combined),
    }


def main() -> None:
    session = requests.Session()
    session.headers.update(HTTP_HEADERS)

    initial = session.get(SOURCE_URL, timeout=45)
    initial.raise_for_status()
    base_headers, base_rows = parse_table(initial.text)
    if len(base_rows) < MIN_BASE_ROWS:
        raise RuntimeError(
            f"La tabla inicial de Cerro Navia parece incompleta: solo {len(base_rows)} filas; "
            f"se requieren al menos {MIN_BASE_ROWS} para validar la fuente."
        )

    all_rows: list[dict[str, str]] = []
    seen: set[tuple[str, ...]] = set()
    query_rows: dict[str, int] = {}
    query_headers: dict[str, list[str]] = {}

    for term in SEARCH_TERMS:
        headers, rows = query_filtered_rows(session, term)
        query_rows[term] = len(rows)
        query_headers[term] = headers
        for row in rows:
            identity = row_identity(row)
            if identity in seen:
                continue
            seen.add(identity)
            all_rows.append(row)

    medication_keys = [
        "metformina500",
        "metformina750",
        "empagliflozina",
        "empaMet12_5_1000",
        "vildaMet",
    ]
    medications: dict[str, dict] = {}

    for key in medication_keys:
        matches = []
        for row in all_rows:
            if not is_match(key, row):
                continue
            match = to_match(key, row)
            if match["stock"] is not None and match["stock"] <= 0:
                continue
            matches.append(match)

        matches.sort(
            key=lambda item: (
                item["price"] is None,
                item["price"] or 10**12,
                -(item["stock"] or 0),
                item["product"],
                item["botica"],
            )
        )
        medications[key] = {
            "available": bool(matches),
            "best_price": next((item["price"] for item in matches if item["price"] is not None), None),
            "matches": matches,
        }

    payload = {
        "status": "ok",
        "farmacia": "Cerro Navia",
        "source_url": SOURCE_URL,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source_mode": "server_search",
        "base_rows": len(base_rows),
        "source_rows": len(all_rows),
        "query_rows": query_rows,
        "source_headers": base_headers,
        "query_headers": query_headers,
        "source_note": "El consultor oficial indica que no muestra medicamentos con stock cero.",
        "medications": medications,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    available_count = sum(1 for value in medications.values() if value["available"])
    print(
        f"Cerro Navia: filtros {query_rows}; {len(all_rows)} filas únicas; "
        f"{available_count}/{len(medication_keys)} medicamentos objetivo publicados."
    )
    for key, value in medications.items():
        print(key, "disponible" if value["available"] else "sin coincidencia", value["best_price"], len(value["matches"]))


if __name__ == "__main__":
    main()
