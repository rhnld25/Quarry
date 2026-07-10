#!/usr/bin/env python3
"""
Quarry license tool — keygen + minting.

Signs offline-verifiable license tokens with ECDSA P-256 (SHA-256).
The Quarry app verifies them in-browser with the Web Crypto SubtleCrypto API
(zero dependency, works in every modern browser and in Electron).

Token format:  base64url(payloadJSON) + "." + base64url(rawSignature)
  - payloadJSON : the license claims, UTF-8, compact separators
  - rawSignature: 64-byte IEEE-P1363 (r||s) ECDSA signature over the payload bytes
                  (SubtleCrypto expects raw r||s, NOT DER)

Usage:
  python tools/quarry_license.py keygen
      -> writes build/keys/quarry_private.pem  (KEEP SECRET, gitignored)
         and prints the public key (raw base64) to embed in the app.

  python tools/quarry_license.py pubkey
      -> re-prints the embeddable public key from the existing private key.

  python tools/quarry_license.py mint --client acme-dental --plan monthly \
         --quota 100 --period monthly --days 31 --features offline_mode,branding
      -> prints a license token. Redirect to a client's license.json:
         { "token": "<paste>" }
"""
import argparse, base64, json, os, sys
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, utils

KEYDIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "build", "keys")
PRIV_PEM = os.path.join(KEYDIR, "quarry_private.pem")


def b64u(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def load_private():
    if not os.path.exists(PRIV_PEM):
        sys.exit("No private key. Run:  python tools/quarry_license.py keygen")
    with open(PRIV_PEM, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def public_raw_b64(priv) -> str:
    # Uncompressed point (0x04 || X || Y), 65 bytes. Imported in-app via
    # SubtleCrypto.importKey('raw', ...). Standard base64 (not url) for embedding.
    raw = priv.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    return base64.b64encode(raw).decode()


def cmd_keygen(_):
    os.makedirs(KEYDIR, exist_ok=True)
    if os.path.exists(PRIV_PEM):
        sys.exit(f"Private key already exists at {PRIV_PEM} — refusing to overwrite.")
    priv = ec.generate_private_key(ec.SECP256R1())
    with open(PRIV_PEM, "wb") as f:
        f.write(priv.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ))
    print(f"Wrote private key: {PRIV_PEM}  (KEEP SECRET)")
    print("\nEmbed this public key in the app (QUARRY_LICENSE_PUBKEY):\n")
    print(public_raw_b64(priv))


def cmd_pubkey(_):
    print(public_raw_b64(load_private()))


def cmd_mint(args):
    priv = load_private()
    now = datetime.now(timezone.utc).replace(microsecond=0)
    exp = now + timedelta(days=args.days)
    payload = {
        "client_id": args.client,
        "key_id": args.key_id or ("k_" + now.strftime("%Y%m%d") + "_" + args.client[:6]),
        "plan": args.plan,
        "quota": args.quota,
        "period": args.period,
        "features": [f for f in (args.features or "").split(",") if f],
        "issued_at": now.isoformat().replace("+00:00", "Z"),
        "expires_at": exp.isoformat().replace("+00:00", "Z"),
    }
    payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()

    der = priv.sign(payload_bytes, ec.ECDSA(hashes.SHA256()))
    r, s = utils.decode_dss_signature(der)
    raw_sig = r.to_bytes(32, "big") + s.to_bytes(32, "big")  # IEEE P-1363 for SubtleCrypto

    token = b64u(payload_bytes) + "." + b64u(raw_sig)
    if args.json:
        print(json.dumps({"token": token}, indent=2))
    else:
        print(token)
    print("\n# claims:", json.dumps(payload, indent=2), file=sys.stderr)


def main():
    p = argparse.ArgumentParser(description="Quarry license keygen + minting")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("keygen").set_defaults(fn=cmd_keygen)
    sub.add_parser("pubkey").set_defaults(fn=cmd_pubkey)
    m = sub.add_parser("mint")
    m.add_argument("--client", required=True)
    m.add_argument("--plan", default="monthly", choices=["report", "monthly", "credits"])
    m.add_argument("--quota", type=int, default=100)
    m.add_argument("--period", default="monthly", choices=["monthly", "one_time"])
    m.add_argument("--days", type=int, default=31, help="days until expiry")
    m.add_argument("--features", default="offline_mode")
    m.add_argument("--key-id", dest="key_id", default="")
    m.add_argument("--json", action="store_true", help="emit {\"token\": ...} JSON")
    m.set_defaults(fn=cmd_mint)
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
