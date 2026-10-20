def _find(client, name, brand):
    items = client.get("/api/paints", params={"q": name, "brand": brand}).json()["items"]
    return next(p for p in items if p["name"] == name)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_import_respects_brand_and_range_filters(client):
    brands = {b["slug"]: b["paint_count"] for b in client.get("/api/brands").json()}
    assert set(brands) == {"citadel", "vallejo"}  # "Unknown" is not in catalog.py
    assert brands["citadel"] == 7
    assert brands["vallejo"] == 6  # Model Air is skipped


def test_import_is_idempotent(client):
    from app.db import SessionLocal
    from app.importer import import_catalog
    from tests.fixtures import CITADEL_MD

    with SessionLocal() as session:
        result = import_catalog(session, {"Citadel_Colour": CITADEL_MD})
    assert result.created == 0 and result.updated == 7


def test_search_hides_discontinued_by_default(client):
    names = [p["name"] for p in client.get("/api/paints", params={"brand": "citadel"}).json()["items"]]
    assert "Old Paint" not in names
    names = [
        p["name"]
        for p in client.get("/api/paints", params={"brand": "citadel", "include_discontinued": True}).json()["items"]
    ]
    assert "Old Paint" in names


def test_search_is_typo_tolerant(client):
    items = client.get("/api/paints", params={"q": "abadon blak"}).json()["items"]
    assert items and items[0]["name"] == "Abaddon Black"


def test_equivalents_stay_within_type_group(client):
    bloody_red = _find(client, "Bloody Red", "vallejo")
    matches = client.get(f"/api/paints/{bloody_red['id']}/equivalents", params={"brand": "citadel"}).json()
    assert matches[0]["paint"]["name"] == "Mephiston Red"
    assert all(m["paint"]["type"] not in ("shade", "contrast") for m in matches)
    assert matches[0]["quality"] in ("near_identical", "close")


def test_match_by_hex_per_brand(client):
    results = client.get("/api/match", params={"hex": "0D407F"}).json()
    by_brand = {r["paint"]["brand"]["slug"]: r for r in results}
    assert by_brand["citadel"]["paint"]["name"] == "Macragge Blue"
    assert by_brand["citadel"]["delta_e"] == 0
    assert by_brand["vallejo"]["paint"]["name"] == "Magic Blue"


def test_inventory_flow_with_reference_match(client):
    bloody_red = _find(client, "Bloody Red", "vallejo")
    created = client.post("/api/inventory", json={"paint_id": bloody_red["id"], "quantity": 2})
    assert created.status_code == 201
    item = created.json()

    listing = client.get("/api/inventory").json()
    row = next(i for i in listing if i["id"] == item["id"])
    assert row["paint"]["owned"] is True
    assert row["reference_match"]["paint"]["name"] == "Mephiston Red"

    updated = client.patch(f"/api/inventory/{item['id']}", json={"status": "low", "tags": ["Blood Angels", " "]})
    assert updated.json()["status"] == "low"
    assert updated.json()["tags"] == ["Blood Angels"]

    csv_text = client.get("/api/inventory/export.csv", params={"status": "low"}).text
    assert "Bloody Red" in csv_text

    assert client.delete(f"/api/inventory/{item['id']}").status_code == 204


def test_reference_brand_setting(client):
    assert client.get("/api/settings").json()["reference_brand"] == "citadel"
    assert client.put("/api/settings", json={"reference_brand": "nope"}).status_code == 404
    assert client.put("/api/settings", json={"reference_brand": "vallejo"}).json()["reference_brand"] == "vallejo"

    mephiston = _find(client, "Mephiston Red", "citadel")
    item = client.post("/api/inventory", json={"paint_id": mephiston["id"]}).json()
    row = next(i for i in client.get("/api/inventory").json() if i["id"] == item["id"])
    assert row["reference_match"]["paint"]["name"] == "Bloody Red"

    client.put("/api/settings", json={"reference_brand": "citadel"})
    client.delete(f"/api/inventory/{item['id']}")


def test_custom_paint_and_hex_override(client):
    created = client.post(
        "/api/paints", json={"brand_name": "Two Thin Coats", "name": "Dragon Red", "hex": "a01010", "type": "base"}
    )
    assert created.status_code == 201
    paint = created.json()
    assert paint["hex"] == "#A01010" and paint["custom"] is True and paint["brand"]["slug"] == "two-thin-coats"

    patched = client.patch(f"/api/paints/{paint['id']}", json={"hex": "#112233"}).json()
    assert patched["hex"] == "#112233"
    assert client.delete(f"/api/paints/{paint['id']}").status_code == 204

    black = _find(client, "Abaddon Black", "citadel")
    assert client.delete(f"/api/paints/{black['id']}").status_code == 400


def test_curated_equivalent_takes_priority(client):
    black = _find(client, "Abaddon Black", "citadel")
    magic_blue = _find(client, "Magic Blue", "vallejo")
    created = client.post(f"/api/paints/{black['id']}/equivalents", json={"equivalent_paint_id": magic_blue["id"]})
    assert created.status_code == 201
    matches = client.get(f"/api/paints/{black['id']}/equivalents", params={"brand": "vallejo"}).json()
    assert matches[0]["quality"] == "curated" and matches[0]["paint"]["name"] == "Magic Blue"
    client.delete(f"/api/paints/{black['id']}/equivalents/{magic_blue['id']}")


IMPORT_CSV = """Brand;Series;Colour;Conversion;Ilość;Stan
Vallejo;Game Color;Warm Gray;Rakath Flesh;;
Vallejo;Model Color;Leather Brown;Mephiston Red / Macragge Blue;2;low
Citadel;Base;Abaddon Black ;;;
Foo Paints;Base;Something;;;
Vallejo;Game Color;Bloody Redd;;;do kupienia
Citadel;Base;Totally Unknown Colour;;;
"""


def test_import_template(client):
    text = client.get("/api/inventory/template.csv").text
    assert text.startswith("Brand,Series,Colour,Conversion,Quantity,Status")


def test_collection_import_preview_then_save(client):
    preview = client.post("/api/inventory/import", json={"csv": IMPORT_CSV, "dry_run": True}).json()
    rows = {r["name"].strip(): r for r in preview["rows"]}
    assert rows["Warm Gray"]["match"] == "exact" and rows["Warm Gray"]["paint"]["name"] == "Warm Grey"
    assert rows["Warm Gray"]["conversions"][0]["match"] == "fuzzy"
    assert rows["Warm Gray"]["conversions"][0]["paint"]["name"] == "Rakarth Flesh"
    assert rows["Leather Brown"]["paint"]["range_name"] == "Model Color"
    assert [c["paint"]["name"] for c in rows["Leather Brown"]["conversions"]] == ["Mephiston Red", "Macragge Blue"]
    assert rows["Something"]["match"] == "unknown_brand"
    assert rows["Bloody Redd"]["match"] == "fuzzy" and rows["Bloody Redd"]["paint"]["name"] == "Bloody Red"
    assert rows["Totally Unknown Colour"]["match"] == "not_found"
    assert preview["summary"]["added"] == 4 and preview["summary"]["skipped"] == 2
    assert client.get("/api/inventory").json() == []  # dry run saved nothing

    saved = client.post("/api/inventory/import", json={"csv": IMPORT_CSV, "dry_run": False}).json()
    assert saved["summary"]["added"] == 4 and saved["summary"]["equivalents_added"] == 3
    items = {i["paint"]["name"]: i for i in client.get("/api/inventory").json()}
    assert items["Leather Brown"]["quantity"] == 2 and items["Leather Brown"]["status"] == "low"
    assert items["Bloody Red"]["status"] == "wishlist" and items["Bloody Red"]["quantity"] == 0
    assert items["Leather Brown"]["reference_match"]["quality"] == "curated"

    again = client.post("/api/inventory/import", json={"csv": IMPORT_CSV, "dry_run": False}).json()
    assert again["summary"]["added"] == 0 and again["summary"]["unchanged"] == 4
    assert again["summary"]["equivalents_added"] == 0
