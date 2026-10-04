"""Gate-6 launcher IO: paths, never JSON/native-code strings through PS5.1."""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=["check", "snapshot", "cleanup"])
    parser.add_argument("--pid", type=int)
    parser.add_argument("--input")
    parser.add_argument("--output")
    args = parser.parse_args()
    result = {"tracked": [], "remaining": [], "errors": []}
    try:
        import psutil

        if args.mode == "check":
            return 0
        if not args.output:
            raise ValueError("--output is required")
        if args.mode == "snapshot":
            root = psutil.Process(args.pid)
            for proc in [root] + root.children(recursive=True):
                try:
                    result["tracked"].append({"pid": proc.pid, "startedAt": proc.create_time()})
                except psutil.NoSuchProcess:
                    pass
        else:
            # utf-8-sig also accepts PS5.1 Set-Content's optional BOM.
            owned = json.loads(Path(args.input).read_text(encoding="utf-8-sig"))
            if not isinstance(owned, list):
                raise ValueError("Owned process identities must be a JSON array")
            seen, waiting = set(), []
            for item in owned:
                identity = (item["pid"], item["startedAt"])
                if identity in seen:
                    continue
                if not isinstance(identity[0], int) or identity[0] <= 0:
                    raise ValueError("Invalid recorded process ID")
                seen.add(identity)
                result["tracked"].append(item)
                try:
                    proc = psutil.Process(item["pid"])
                    if proc.create_time() == item["startedAt"]:
                        proc.kill()
                        waiting.append(proc)
                except psutil.NoSuchProcess:
                    pass
                except psutil.AccessDenied:
                    result["errors"].append({"pid": item["pid"], "reason": "access denied"})
            _, alive = psutil.wait_procs(waiting, timeout=5)
            result["remaining"] = [proc.pid for proc in alive]
    except Exception as error:
        result["errors"].append({"reason": type(error).__name__ + ": " + str(error)})
    finally:
        if args.output:
            Path(args.output).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return 1 if result["remaining"] or result["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
