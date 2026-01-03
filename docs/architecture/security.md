# Scan Security Considerations

## Scope and Data Handling

- Scans only local filesystem paths; no network access during `scan`.
- Output includes file contents by default; use `--no-content` to suppress content in JSON output.
- Prefer `--repo-only` in shared environments to avoid scanning user home directories.
- Global scope scanning is opt-in only; avoid enabling it unless required for compliance/audits.

## Symlinks and Path Traversal

- Symlinks are followed to honor real configuration locations.
- The scanner tracks visited inodes to avoid circular symlink loops and emits warnings.
- Symlinks can point outside the scan roots; external targets are included as resolved paths.
- Treat scan output as sensitive when symlinks reach outside a repo or home directory.

## Permissions and Errors

- Permission-denied directories/files are reported as warnings and do not abort the scan.
- Unreadable files are still surfaced with error metadata so audits can review gaps.

## Global Scope Guardrails

- Default global root is `/etc` (Unix-like); global scope is **disabled by default**.
- Do not expand global scope to `/` or other system roots without an explicit flag.
- Skip special files (device nodes, FIFOs, sockets) to avoid hangs or unsafe reads.
- Treat all permission issues as warnings; never fail the scan due to global scope access.
- Avoid logging raw contents from global scope; prefer `--no-content` when possible.

## Resource Usage

- There is no size limit for file reads or hashing; large files can increase memory and CPU use.
- Use `--no-content` in shared environments or when content is not required for downstream workflows.

## Operational Guardrails

- Run scans with least privilege.
- Avoid scanning untrusted mounts or networked filesystems unless necessary.
