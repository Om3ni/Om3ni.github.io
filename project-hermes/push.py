"""
Push local project-hermes files to GitHub Pages in a single commit.
Uses the Git Trees API to batch all files into one commit, avoiding
race conditions with GitHub Pages builds.

Usage:  python push.py "commit message" [file1 file2 ...]
    python push.py "commit message"              — pushes all publishable site files
    python push.py "fix gap bug" index.html      — pushes only index.html
"""

import sys, os, base64, json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError  # noqa: F401 — surfaced in api_call via urlopen

# ── Config ──────────────────────────────────────────────────────────────
REPO = "Om3ni/Om3ni.github.io"
REPO_PREFIX = "project-hermes"  # path inside the repo
BRANCH = "main"
API = f"https://api.github.com/repos/{REPO}"
PAT_ENV = "GH_PAT"  # environment variable name
PUBLISHABLE_EXTENSIONS = {
    ".css", ".gif", ".html", ".ico", ".jpeg", ".jpg",
    ".js", ".json", ".png", ".svg", ".webp"
}
EXCLUDED_NAMES = {"push.py", "CALCULATORS.md", "REVIEW.md"}
EXCLUDED_DIRS = {".git", "__pycache__"}
# ────────────────────────────────────────────────────────────────────────


def discover_default_files(project_root):
    """Return all site files that should be published by default."""
    files = []
    for path in project_root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in EXCLUDED_DIRS for part in path.parts):
            continue
        if path.name in EXCLUDED_NAMES:
            continue
        if path.suffix.lower() not in PUBLISHABLE_EXTENSIONS:
            continue
        files.append(path.relative_to(project_root).as_posix())
    return sorted(files)


def get_pat():
    pat = os.environ.get(PAT_ENV)
    if pat:
        return pat
    # fallback: prompt
    pat = input("GitHub PAT: ").strip()
    if not pat:
        print("No PAT provided, aborting.")
        sys.exit(1)
    return pat


def api_call(endpoint, headers, method="GET", data=None):
    """Make a GitHub API call and return parsed JSON."""
    url = f"{API}/{endpoint}" if not endpoint.startswith("http") else endpoint
    body = json.dumps(data).encode() if data else None
    req = Request(url, data=body, headers=headers, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    resp = urlopen(req)
    return json.loads(resp.read().decode())


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    message = sys.argv[1]
    project_root = Path(__file__).resolve().parent
    files = sys.argv[2:] if len(sys.argv) > 2 else discover_default_files(project_root)

    pat = get_pat()
    headers = {
        "Authorization": f"token {pat}",
        "Accept": "application/vnd.github.v3+json",
    }

    print(f"\nPushing to {REPO} — \"{message}\"\n")
    if len(sys.argv) <= 2:
        print(f"Auto-selected {len(files)} publishable site file(s).")

    # 1. Get the current commit SHA for the branch
    ref = api_call(f"git/ref/heads/{BRANCH}", headers)
    latest_sha = ref["object"]["sha"]

    # 2. Get the tree SHA from that commit
    commit = api_call(f"git/commits/{latest_sha}", headers)
    base_tree_sha = commit["tree"]["sha"]

    # 3. Build tree entries — one blob per file
    tree_items = []
    for f in files:
        requested = Path(f)
        local = requested if requested.is_absolute() else project_root / requested
        if not local.exists():
            print(f"  ! {f} — file not found locally, skipping")
            continue
        try:
            relative = local.resolve().relative_to(project_root)
        except ValueError:
            print(f"  ! {f} — outside project root, skipping")
            continue

        with open(local, "rb") as fh:
            content_b64 = base64.b64encode(fh.read()).decode("ascii")

        # Create blob
        blob = api_call("git/blobs", headers, method="POST", data={
            "content": content_b64,
            "encoding": "base64"
        })

        remote_path = f"{REPO_PREFIX}/{relative.as_posix()}"
        tree_items.append({
            "path": remote_path,
            "mode": "100644",
            "type": "blob",
            "sha": blob["sha"]
        })
        print(f"  + {remote_path}")

    if not tree_items:
        print("\nNo files to push.")
        sys.exit(1)

    # 4. Create new tree (with base_tree so unchanged files are preserved)
    new_tree = api_call("git/trees", headers, method="POST", data={
        "base_tree": base_tree_sha,
        "tree": tree_items
    })

    # 5. Create commit pointing to new tree
    new_commit = api_call("git/commits", headers, method="POST", data={
        "message": message,
        "tree": new_tree["sha"],
        "parents": [latest_sha]
    })

    # 6. Update branch ref to point to new commit
    api_call(f"git/refs/heads/{BRANCH}", headers, method="PATCH", data={
        "sha": new_commit["sha"]
    })

    print(f"\nDone: {len(tree_items)} file(s) pushed in 1 commit.")
    print(f"Commit: {new_commit['sha'][:8]}")


if __name__ == "__main__":
    main()
