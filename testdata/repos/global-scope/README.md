# Global Scope Fixture

Fixture files used by scan tests to validate global-scope behavior.

- global.md: file that should match global-scope patterns.
- regular.txt: non-matching file used to ensure scans ignore irrelevant files.
- shadow: sensitive-name sample used to confirm skip behavior in global scope.

Special files (e.g., FIFOs) and permission-denied directories are created dynamically in tests.
