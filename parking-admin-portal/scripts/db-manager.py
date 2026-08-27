"""
db_manager.py
-------------
Fetch and delete records from any collection in the Admin-portal MongoDB database.
Collections covered:
    users         - registered user accounts
    sessions      - active login sessions
    car_changes   - car add/remove audit log
Usage examples:
    python db_manager.py fetch users
    python db_manager.py fetch sessions
    python db_manager.py fetch car_changes
    python db_manager.py fetch car_changes --action add
    python db_manager.py fetch car_changes --limit 0
    python db_manager.py fetch car_changes --json
    python db_manager.py delete car_changes --id 6683abc123def456
    python db_manager.py delete car_changes --action delete
    python db_manager.py delete car_changes --all
    python db_manager.py delete sessions --all
    python db_manager.py delete users --id 6683abc123def456
Requirements:
    pip install pymongo python-dotenv
"""
import argparse
import json
import os
import sys
from datetime import timezone
# ── dependency guards ──────────────────────────────────────────────────────────
try:
    from dotenv import load_dotenv
except ImportError:
    print("ERROR: 'python-dotenv' not installed. Run: pip install python-dotenv", file=sys.stderr)
    sys.exit(1)
try:
    from pymongo import MongoClient, DESCENDING
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    from bson import ObjectId
    from bson.errors import InvalidId
except ImportError:
    print("ERROR: 'pymongo' not installed. Run: pip install pymongo", file=sys.stderr)
    sys.exit(1)
# ── config ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
env_local_path = os.path.join(PROJECT_ROOT, ".env.local")
if os.path.exists(env_local_path):
    load_dotenv(env_local_path)
else:
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
MONGODB_URI = os.getenv("MONGODB_URI", "")
FALLBACK_DB = "test"
COLLECTIONS = ["users", "sessions", "car_changes"]
# Columns to display per collection (in order)
DISPLAY_COLS: dict[str, list[str]] = {
    "users": ["_id", "name", "email", "role", "isActive", "parkingEligible", "createdAt"],
    "sessions": ["_id", "userId", "createdAt", "expiresAt", "lastSeenAt", "ipAddress"],
    "car_changes": ["_id", "car number", "action", "userEmail", "userId", "timestamp"],
}
# ── helpers ────────────────────────────────────────────────────────────────────
def get_db_name(uri: str) -> str:
    from urllib.parse import urlparse
    path = urlparse(uri).path.lstrip("/").split("?")[0]
    return path if path else FALLBACK_DB
def connect() -> MongoClient:
    if not MONGODB_URI:
        print("ERROR: MONGODB_URI is not set. Check your .env file.", file=sys.stderr)
        sys.exit(1)
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        return client
    except (ConnectionFailure, ServerSelectionTimeoutError) as exc:
        print(f"ERROR: Could not connect to MongoDB — {exc}", file=sys.stderr)
        sys.exit(1)
def serialise(doc: dict) -> dict:
    """Convert ObjectIds / datetimes to plain strings for display/JSON."""
    out = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            out[k] = str(v)
        elif hasattr(v, "astimezone"):          # datetime
            out[k] = v.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        elif isinstance(v, list):
            out[k] = [serialise(i) if isinstance(i, dict) else str(i) if isinstance(i, ObjectId) else i for i in v]
        elif isinstance(v, dict):
            out[k] = serialise(v)
        else:
            out[k] = v
    return out
def print_table(records: list[dict], cols: list[str]) -> None:
    if not records:
        print("  No records found.")
        return
    widths = {c: len(c) for c in cols}
    for rec in records:
        for c in cols:
            widths[c] = max(widths[c], len(str(rec.get(c, ""))))
    sep    = "+-" + "-+-".join("-" * widths[c] for c in cols) + "-+"
    header = "| " + " | ".join(c.ljust(widths[c]) for c in cols) + " |"
    print(sep)
    print(header)
    print(sep)
    for rec in records:
        row = "| " + " | ".join(str(rec.get(c, "")).ljust(widths[c]) for c in cols) + " |"
        print(row)
    print(sep)
    print(f"\n  {len(records)} record(s) shown.")
def confirm(prompt: str) -> bool:
    try:
        answer = input(f"{prompt} [y/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        return False
    return answer in ("y", "yes")
# ── fetch ──────────────────────────────────────────────────────────────────────
def cmd_fetch(args: argparse.Namespace) -> None:
    collection_name: str = args.collection
    limit: int           = args.limit
    as_json: bool        = args.json
    client = connect()
    db     = client[get_db_name(MONGODB_URI)]
    col    = db[collection_name]
    query: dict = {}
    # car_changes-specific filter
    if collection_name == "car_changes" and args.action:
        query["action"] = args.action
    cursor = col.find(query).sort("_id", DESCENDING)
    if limit > 0:
        cursor = cursor.limit(limit)
    records = [serialise(doc) for doc in cursor]
    client.close()
    if as_json:
        print(json.dumps(records, indent=2, default=str))
        return
    cols = DISPLAY_COLS.get(collection_name, list(records[0].keys()) if records else [])
    print(f"\n=== {collection_name} ({'filtered: ' + args.action if collection_name == 'car_changes' and args.action else 'all'}) ===\n")
    print_table(records, cols)
# ── delete ─────────────────────────────────────────────────────────────────────
def cmd_delete(args: argparse.Namespace) -> None:
    collection_name: str = args.collection
    if not args.id and not args.all and not (collection_name == "car_changes" and args.action):
        print("ERROR: Specify --id <id>, --all, or (for car_changes) --action add|delete.", file=sys.stderr)
        sys.exit(1)
    client = connect()
    db     = client[get_db_name(MONGODB_URI)]
    col    = db[collection_name]
    # ── delete by ID ──────────────────────────────────────────────────────────
    if args.id:
        try:
            oid = ObjectId(args.id)
        except InvalidId:
            print(f"ERROR: '{args.id}' is not a valid ObjectId.", file=sys.stderr)
            client.close()
            sys.exit(1)
        doc = col.find_one({"_id": oid})
        if not doc:
            print(f"  No document with _id={args.id} found in '{collection_name}'.")
            client.close()
            return
        print(f"\n  Document to delete from '{collection_name}':")
        print(f"  {json.dumps(serialise(doc), indent=4, default=str)}\n")
        if confirm("  Delete this document?"):
            col.delete_one({"_id": oid})
            print("  [SUCCESS] Deleted.")
        else:
            print("  Cancelled.")
        client.close()
        return
    # ── delete by action (car_changes only) ──────────────────────────────────
    if collection_name == "car_changes" and args.action:
        count = col.count_documents({"action": args.action})
        if count == 0:
            print(f"  No '{args.action}' records found in car_changes.")
            client.close()
            return
        if confirm(f"  Delete ALL {count} '{args.action}' records from car_changes?"):
            result = col.delete_many({"action": args.action})
            print(f"  [SUCCESS] Deleted {result.deleted_count} record(s).")
        else:
            print("  Cancelled.")
        client.close()
        return
    # ── delete all ────────────────────────────────────────────────────────────
    if args.all:
        count = col.count_documents({})
        if count == 0:
            print(f"  Collection '{collection_name}' is already empty.")
            client.close()
            return
        print(f"\n  [WARNING] This will permanently delete ALL {count} document(s) from '{collection_name}'.\n")
        if confirm(f"  Are you sure you want to wipe '{collection_name}'?"):
            result = col.delete_many({})
            print(f"  [SUCCESS] Deleted {result.deleted_count} document(s).")
        else:
            print("  Cancelled.")
        client.close()
# ── CLI setup ──────────────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="db_manager.py",
        description="Fetch or delete records from the Admin-portal MongoDB database.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    # ── fetch sub-command ─────────────────────────────────────────────────────
    fetch_p = sub.add_parser("fetch", help="Fetch records from a collection.")
    fetch_p.add_argument(
        "collection", choices=COLLECTIONS,
        help="Collection to read from.",
    )
    fetch_p.add_argument(
        "--limit", type=int, default=50,
        help="Max records to return (0 = all, default: 50).",
    )
    fetch_p.add_argument(
        "--action", choices=["add", "delete"], default=None,
        help="[car_changes only] Filter by action type.",
    )
    fetch_p.add_argument(
        "--json", dest="json", action="store_true",
        help="Output raw JSON instead of a table.",
    )
    # ── delete sub-command ────────────────────────────────────────────────────
    del_p = sub.add_parser("delete", help="Delete records from a collection.")
    del_p.add_argument(
        "collection", choices=COLLECTIONS,
        help="Collection to delete from.",
    )
    del_g = del_p.add_mutually_exclusive_group(required=True)
    del_g.add_argument(
        "--id", metavar="OBJECT_ID",
        help="Delete a single document by its _id.",
    )
    del_g.add_argument(
        "--action", choices=["add", "delete"],
        help="[car_changes only] Delete all records with this action.",
    )
    del_g.add_argument(
        "--all", action="store_true",
        help="Delete ALL documents in the collection (prompts for confirmation).",
    )
    return parser
def main() -> None:
    parser = build_parser()
    args   = parser.parse_args()
    if args.command == "fetch":
        cmd_fetch(args)
    elif args.command == "delete":
        cmd_delete(args)
if __name__ == "__main__":
    main()
