"""Utility script to populate store Card records from the Pokemon TCG API."""

import argparse
import logging
import os
import time
from decimal import Decimal, ROUND_HALF_UP

import django
import requests


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pokemartbackend.settings")
django.setup()

from django.db import transaction  # noqa: E402

from store.models import Card  # noqa: E402


API_URL = "https://api.pokemontcg.io/v2/cards"
API_KEY = "a79b13e7-d8bb-40cb-bcd6-d55817f19aca"

logger = logging.getLogger(__name__)

MAX_RETRIES = 5
RETRY_DELAY_SECONDS = 5


def get_headers() -> dict:
    return {
        "Accept": "application/json",
        "X-Api-Key": API_KEY,
    }


def quantize_price(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def pick_recommended_price(card_payload: dict) -> Decimal | None:
    price_fields = (
        "market",
        "mid",
        "averageSellPrice",
        "avg1",
        "avg7",
        "avg30",
        "low",
        "high",
    )
    sources = []
    tcgplayer = card_payload.get("tcgplayer", {})
    if isinstance(tcgplayer, dict):
        sources.append(tcgplayer.get("prices", {}))
    cardmarket = card_payload.get("cardmarket", {})
    if isinstance(cardmarket, dict):
        sources.append(cardmarket.get("prices", {}))
    for price_source in sources:
        if not isinstance(price_source, dict):
            continue
        for price_variant in price_source.values():
            if not isinstance(price_variant, dict):
                continue
            for field in price_fields:
                value = price_variant.get(field)
                if value is None:
                    continue
                try:
                    return quantize_price(Decimal(str(value)))
                except (ValueError, ArithmeticError):
                    logger.debug("Skipping non-numeric price %s", value)
    return None


def extract_card_defaults(card_payload: dict) -> dict:
    set_info = card_payload.get("set") or {}
    images = card_payload.get("images") or {}
    price = pick_recommended_price(card_payload)
    image_url = images.get("large") or images.get("small")
    if not image_url:
        return {}
    recommended = price if price is not None else Decimal("0.00")
    return {
        "name": card_payload.get("name", "Unknown"),
        "collection": set_info.get("name", "Unknown"),
        "rarity": card_payload.get("rarity", "Unknown"),
        "image_url": image_url,
        "recommended_price": quantize_price(recommended),
    }


def upsert_cards(cards: list[dict], existing_keys: set[tuple[str, str]]) -> tuple[int, int]:
    created = 0
    skipped = 0
    with transaction.atomic():
        for card_payload in cards:
            defaults = extract_card_defaults(card_payload)
            if not defaults:
                logger.debug("Skipping card without image: %s", card_payload.get("id"))
                continue
            key = (defaults["name"], defaults["collection"])
            if key in existing_keys:
                skipped += 1
                continue
            Card.objects.create(**defaults)
            existing_keys.add(key)
            created += 1
    return created, skipped


def fetch_cards(query: str | None, order_by: str | None, page_size: int, max_pages: int | None) -> None:
    session = requests.Session()
    session.headers.update(get_headers())
    try:
        current_page = 3
        total_created = 0
        total_skipped = 0
        existing_keys = set(Card.objects.values_list("name", "collection"))
        while True:
            params = {"page": current_page}
            if page_size:
                params["pageSize"] = page_size
            if query:
                params["q"] = query
            if order_by:
                params["orderBy"] = order_by
            response = request_with_retry(session, params)
            if response.status_code == 404:
                logger.info("Reached end of pagination at page %s", current_page)
                break
            response.raise_for_status()
            payload = response.json()
            cards = payload.get("data", [])
            if not cards:
                logger.info("No cards returned on page %s", current_page)
                break
            created, skipped = upsert_cards(cards, existing_keys)
            total_created += created
            total_skipped += skipped
            logger.info(
                "Processed page %s (created=%s skipped_existing=%s)",
                current_page,
                created,
                skipped,
            )
            if not page_size or len(cards) < page_size:
                break
            if max_pages and current_page >= max_pages:
                break
            current_page += 1
        logger.info(
            "Import finished: total_created=%s total_skipped_existing=%s",
            total_created,
            total_skipped,
        )
    except requests.RequestException as exc:
        logger.error("Network error while calling Pokemon TCG API: %s", exc)
        raise


def request_with_retry(session: requests.Session, params: dict) -> requests.Response:
    attempt = 1
    while True:
        try:
            response = session.get(API_URL, params=params)
        except requests.RequestException as exc:
            if attempt >= MAX_RETRIES:
                raise
            logger.warning("Request error (attempt %s/%s): %s", attempt, MAX_RETRIES, exc)
            time.sleep(RETRY_DELAY_SECONDS)
            attempt += 1
            continue
        if response.status_code >= 500:
            if attempt >= MAX_RETRIES:
                return response
            logger.warning(
                "Server error %s (attempt %s/%s). Retrying in %ss.",
                response.status_code,
                attempt,
                MAX_RETRIES,
                RETRY_DELAY_SECONDS,
            )
            time.sleep(RETRY_DELAY_SECONDS)
            attempt += 1
            continue
        return response


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import Pokemon TCG cards into store_card table")
    parser.add_argument(
        "--query",
        "-q",
        dest="query",
        help="Pokemon TCG API search query (q parameter)",
    )
    parser.add_argument(
        "--order-by",
        dest="order_by",
        help="Field ordering for the API (orderBy parameter)",
    )
    parser.add_argument(
        "--page-size",
        dest="page_size",
        type=int,
        default=250,
        help="Cards per page to request (max 250)",
    )
    parser.add_argument(
        "--max-pages",
        dest="max_pages",
        type=int,
        help="Limit number of pages to fetch",
    )
    return parser.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    args = parse_args()
    fetch_cards(args.query, args.order_by, args.page_size, args.max_pages)
