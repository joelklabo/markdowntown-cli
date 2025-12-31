# Scan Security Considerations

## Scope and Data Handling
- Scans only local filesystem paths; no network access during `scan`.
- Output may include sensitive paths and file contents when `--include-content` is used.
- Prefer `--repo-only` in shared environments to avoid scanning user home directories.

## Symlinks and Path Traversal
- Symlinks are followed to honor real configuration locations.
- The scanner tracks visited inodes to avoid circular symlink loops and emits warnings.
- Symlinks can point outside the scan roots; external targets are included as resolved paths.
- Treat scan output as sensitive when symlinks reach outside a repo or home directory.

## Permissions and Errors
- Permission-denied directories/files are reported as warnings and do not abort the scan.
- Unreadable files are still surfaced with error metadata so audits can review gaps.

## Resource Usage
- There is no size limit for file reads or hashing; large files can increase memory and CPU use.
- Use `--include-content` only when content is required for downstream workflows.

## Operational Guardrails
- Run scans with least privilege.
- Avoid scanning untrusted mounts or networked filesystems unless necessary.
