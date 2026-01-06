# Deployment Rollback Runbook

This runbook covers rolling back deployments for the markdowntown monorepo components.

## When to Rollback

Rollback when:
- Critical bugs discovered in production
- Performance degradation detected
- Database migration fails
- Security vulnerability introduced

## Rollback Scope

Different components can be rolled back independently:
- **Web app**: Roll back container image
- **Worker**: Roll back container image  
- **CLI**: Users control via binary version

## Web App Rollback

### Azure Container Apps

1. **List revisions:**
   ```bash
   az containerapp revision list \
     -g <resource-group> \
     -n markdowntown-web \
     --query "[].{Name:name, Active:active, Created:createdTime}" \
     -o table
   ```

2. **Activate previous revision:**
   ```bash
   az containerapp revision activate \
     -g <resource-group> \
     -n markdowntown-web \
     --revision <previous-revision-name>
   ```

3. **Verify traffic shift:**
   ```bash
   az containerapp revision show \
     -g <resource-group> \
     -n markdowntown-web \
     --revision <revision-name> \
     --query "{Name:name, TrafficWeight:trafficWeight}"
   ```

4. **Deactivate bad revision:**
   ```bash
   az containerapp revision deactivate \
     -g <resource-group> \
     -n markdowntown-web \
     --revision <bad-revision-name>
   ```

### Manual Docker Deployment

1. **Pull previous image:**
   ```bash
   docker pull ghcr.io/joelklabo/markdowntown-cli/web:v1.2.2
   ```

2. **Stop current container:**
   ```bash
   docker stop markdowntown-web
   docker rm markdowntown-web
   ```

3. **Start previous version:**
   ```bash
   docker run -d \
     --name markdowntown-web \
     -p 3000:3000 \
     --env-file .env.production \
     ghcr.io/joelklabo/markdowntown-cli/web:v1.2.2
   ```

4. **Verify health:**
   ```bash
   curl http://localhost:3000/api/health
   ```

## Worker Rollback

### Azure Container Apps Job

1. **List job executions:**
   ```bash
   az containerapp job execution list \
     -g <resource-group> \
     -n markdowntown-worker \
     --query "[].{Name:name, Status:status, Created:createdTime}" \
     -o table
   ```

2. **Update job template:**
   ```bash
   az containerapp job update \
     -g <resource-group> \
     -n markdowntown-worker \
     --image ghcr.io/joelklabo/markdowntown-cli/worker:v1.2.2
   ```

3. **Verify update:**
   ```bash
   az containerapp job show \
     -g <resource-group> \
     -n markdowntown-worker \
     --query "properties.template.containers[0].image"
   ```

### Manual Image Push

If CI is failing, you can push manually to ACR:

```bash
# Example for markdowntown-web
az acr login --name $ACR_NAME
docker build -t $ACR_NAME.azurecr.io/markdowntown-web:manual .
docker push $ACR_NAME.azurecr.io/markdowntown-web:manual
```

## Database Migration Rollback

**CRITICAL**: Database rollbacks are risky. Always test migrations in staging first.

### Prisma Migrations

Prisma doesn't support automatic rollback. Manual steps required:

1. **Identify bad migration:**
   ```bash
   pnpm -C apps/web exec prisma migrate status
   ```

2. **Restore database from backup:**
   ```bash
   # Azure PostgreSQL Flexible Server
   az postgres flexible-server restore \
     -g <resource-group> \
     -n markdowntown-db-rollback \
     --source-server markdowntown-db \
     --restore-point-in-time "2026-01-05T00:00:00Z"
   ```

3. **Point app to restored DB** (update connection string)

4. **Re-apply known good migrations:**
   ```bash
   pnpm -C apps/web exec prisma migrate deploy
   ```

### Prevention

- Always create DB backup before risky migrations
- Test migrations in staging with production-like data
- Use two-phase migrations for breaking changes (add column → backfill → drop old column)

## CLI Rollback

CLI rollback is user-driven:

1. **Announce previous version:**
   Communicate to users via GitHub release notes or docs.

2. **Users download previous version:**
   ```bash
   # Example for v1.2.2
   curl -L https://github.com/joelklabo/markdowntown-cli/releases/download/v1.2.2/markdowntown_v1.2.2_darwin_arm64.tar.gz | tar xz
   ```

3. **Update documentation** to recommend previous version until fix is ready.

## Post-Rollback

After successful rollback:

1. **Verify metrics:**
   - Error rates returned to normal
   - Performance metrics recovered
   - User reports decreased

2. **Root cause analysis:**
   - Identify what went wrong
   - Document failure mode
   - Update testing to catch issue

3. **Prepare fix:**
   - Create hotfix branch if needed
   - Add regression test
   - Deploy fix to staging first

4. **Communicate:**
   - Update status page (if applicable)
   - Notify affected users
   - Post-mortem document (for major incidents)

## Rollback Testing

Periodically test rollback procedures:
- In staging environment
- Document time to rollback
- Identify gaps in runbook
- Update automation if needed

## Emergency Contacts

- **Azure support**: [Azure Portal → Support]
- **On-call engineer**: [PagerDuty/on-call schedule]
- **Database admin**: [Contact info]

## Common Issues

### Container won't start after rollback

- Check environment variables haven't changed
- Verify secrets are accessible
- Review container logs: `az containerapp logs show ...`

### Database schema mismatch

- Rolled back app but not DB (or vice versa)
- Solution: Ensure DB and app versions are compatible
- May need to roll back both or fast-forward both

### Cache invalidation needed

- Old code cached in CDN
- Solution: Purge CDN cache or wait for TTL
- Consider versioned asset URLs to avoid this

## References

- [Azure Container Apps revision management](https://learn.microsoft.com/azure/container-apps/revisions)
- [Azure PostgreSQL backup/restore](https://learn.microsoft.com/azure/postgresql/flexible-server/concepts-backup-restore)
- [Prisma migrations guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
