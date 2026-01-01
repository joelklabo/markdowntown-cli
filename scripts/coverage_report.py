#!/usr/bin/env python3
import argparse
import os
import sys
from collections import defaultdict

def parse_profile(path):
    totals = defaultdict(lambda: [0, 0])
    with open(path, encoding="utf-8") as handle:
        header = handle.readline()
        if not header.startswith("mode:"):
            raise ValueError("coverage profile missing mode header")
        for raw in handle:
            line = raw.strip()
            if not line:
                continue
            try:
                file_part, rest = line.rsplit(":", 1)
            except ValueError:
                continue
            fields = rest.split()
            if len(fields) != 3:
                continue
            try:
                statements = int(fields[1])
                count = int(fields[2])
            except ValueError:
                continue
            path = file_part.replace("\\", "/")
            package = os.path.dirname(path)
            totals[package][1] += statements
            if count > 0:
                totals[package][0] += statements
    return totals

def percent(covered, total):
    if total == 0:
        return 0.0
    return (covered / total) * 100

def main():
    parser = argparse.ArgumentParser(description="Report per-package coverage from a Go coverprofile.")
    parser.add_argument("profile", help="Path to coverage.out")
    parser.add_argument("--min", type=float, default=None, help="Minimum total coverage percentage")
    args = parser.parse_args()

    try:
        totals = parse_profile(args.profile)
    except FileNotFoundError:
        print(f"coverage profile not found: {args.profile}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if not totals:
        print("no coverage data found", file=sys.stderr)
        return 1

    total_covered = sum(covered for covered, _ in totals.values())
    total_statements = sum(total for _, total in totals.values())

    print("Per-package coverage:")
    for package in sorted(totals.keys()):
        covered, total = totals[package]
        pct = percent(covered, total)
        print(f"{pct:6.2f}% {package}")

    total_pct = percent(total_covered, total_statements)
    print(f"Total coverage: {total_pct:.2f}% ({total_covered}/{total_statements} statements)")

    if args.min is not None and total_pct < args.min:
        print(f"coverage {total_pct:.2f}% < {args.min:.2f}%", file=sys.stderr)
        return 1
    if args.min is not None:
        print(f"coverage {total_pct:.2f}% >= {args.min:.2f}%")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
