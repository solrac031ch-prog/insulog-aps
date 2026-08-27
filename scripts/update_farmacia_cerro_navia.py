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

SOURCE_URL = "https://farmaciapopularonline.cl/consultor?farmacia=cerro%20navia"
OUTPUT = Path("data/farmacia-cerro-navia.json")


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


def infer_variant(key: str, combined: str) -> str:
    text = normalize(combined).replace("1.000", "1000")
    if key == "empagliflozina":
        if re.search(r"\b10\s*mg\b", text):
            return "10"
        if re.search(r"\b25\s*mg\b", text):
            return "25"
    if key == "vildaMet":
        if "50/500" in text or ("50 mg" in text and "500 mg" in text):
            return "50/500"
        if "50/850" in text or ("50 mg" in text and "850 mg" in text):
            return "50/850"
        if "50/1000" in text or ("50 mg" in text and "1000 mg" in text):
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
        return "metformina" in principle and all(x not in principle for x in ("vildagliptina", "empagliflozina")) and bool(re.search(r"\b500\s*mg\b", combined))
    if key == "metformina750":
        return "metformina" in principle and all(x not in principle for x in ("vildagliptina", "empagliflozina")) and bool(re.search(r"\b750\s*mg\b", combined))
    if key == "empagliflozina":
        return "empagliflozina" in principle and "metformina" not in principle
    if key == "empaMet12_5_1000":
        return "empagliflozina" in combined and "metformina" in combined
    if key == "vildaMet":
        return "vildagliptina" in combined and "metformina" in combined
    return False


def main() -> None:
    response = requests.get(
        SOURCE_URL,
        timeout=45,
        headers={
            "User-Agent": "InsulogAPS/1.0 (+https://solrac031ch-prog.github.io/insulog-aps/)",
            "Accept-Language": "es-CL,es;q=0.9",
        },
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")
    if table is None:
        raise RuntimeError("No se encontró la tabla de medicamentos de Cerro Navia")

    headers = [key_for_header(th.get_text(" ", strip=True)) for th in table.select("thead th")]
    if not headers:
        first_row = table.find("tr")
        headers = [key_for_header(cell.get_text(" ", strip=True)) for cell in first_row.find_all(["th", "td"])] if first_row else []

    rows: list[dict[str, str]] = []
    for tr in table.select("tbody tr") or table.find_all("tr")[1:]:
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if not cells:
            continue
        row = {headers[i] if i < len(headers) else f"col_{i}": value for i, value in enumerate(cells)}
        rows.append(row)

    medication_keys = ["metformina500", "metformina750", "empagliflozina", "empaMet12_5_1000", "vildaMet"]
    medications: dict[str, dict] = {}

    for key in medication_keys:
        matches = []
        for row in rows:
            if not is_match(key, row):
                continue
            stock = parse_number(row.get("stock", ""))
            price = parse_number(row.get("price", ""))
            if stock is not None and stock <= 0:
                continue
            combined = f"{row.get('product', '')} {row.get('principle', '')}"
            matches.append(
                {
                    "product": row.get("product", ""),
                    "principle": row.get("principle", ""),
                    "brand": row.get("brand", ""),
                    "botica": row.get("botica", ""),
                    "stock": stock,
                    "unit": row.get("unit", ""),
                    "price": price,
                    "laboratory": row.get("laboratory", ""),
                    "variant": infer_variant(key, combined),
                }
            )

        matches.sort(key=lambda item: (item["price"] is None, item["price"] or 10**12, -(item["stock"] or 0), item["product"]))
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
        "source_note": "El consultor oficial indica que no muestra medicamentos con stock cero.",
        "medications": medications,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
