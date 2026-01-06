#!/bin/bash
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
CATALOG_DOC="$REPO_ROOT/cli/docs/architecture/diagnostic-catalog.md"
RULES_FILE="$REPO_ROOT/cli/internal/audit/rules.go"

echo "Checking diagnostic catalog sync..."

# Extract IDs from catalog doc marked as (Implemented)
# We look for MDxxx (Implemented) at the start of table rows
CATALOG_IDS=$(grep -E "^\| MD[0-9]{3} \(Implemented\) \|" "$CATALOG_DOC" | awk -F'|' '{print $2}' | grep -oE "MD[0-9]{3}" | sort | uniq)

# Extract IDs from rules.go (DefaultRules function and ruleMetadata)
CODE_IDS=$(grep -E '"MD[0-9]{3}"' "$RULES_FILE" | grep -oE "MD[0-9]{3}" | sort | uniq)

# LSP-only IDs that are expected to be in catalog but not in audit rules
LSP_ONLY_IDS="MD000 MD015"

MISSING_IN_CODE=""
for id in $CATALOG_IDS; do
    if ! echo "$CODE_IDS $LSP_ONLY_IDS" | grep -q "$id"; then
        MISSING_IN_CODE="$MISSING_IN_CODE $id"
    fi
done

MISSING_IN_CATALOG=""
for id in $CODE_IDS; do
    if ! echo "$CATALOG_IDS" | grep -q "$id"; then
        MISSING_IN_CATALOG="$MISSING_IN_CATALOG $id"
    fi
done

if [ -n "$MISSING_IN_CODE" ]; then
    echo "Warning: The following IDs are marked Implemented in the catalog but not found in code: $MISSING_IN_CODE"
fi

if [ -n "$MISSING_IN_CATALOG" ]; then
    echo "Error: The following IDs are implemented in code but not marked Implemented in the catalog: $MISSING_IN_CATALOG"
    exit 1
fi

echo "Diagnostic catalog is in sync with code."