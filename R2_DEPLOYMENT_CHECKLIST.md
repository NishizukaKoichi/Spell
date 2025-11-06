# Cloudflare R2 Deployment Checklist

## Pre-Deployment

### 1. Cloudflare R2 Setup
- [ ] Create Cloudflare R2 bucket named `spell-artifacts`
- [ ] Note Account ID from R2 dashboard
- [ ] Generate R2 API token with permissions:
  - [ ] Object Read
  - [ ] Object Write
  - [ ] Object Delete
- [ ] Save Access Key ID
- [ ] Save Secret Access Key
- [ ] (Optional) Configure custom domain for R2 bucket

### 2. Environment Configuration
- [ ] Add R2 credentials to production `.env`:
  ```bash
  R2_ACCOUNT_ID=your_account_id
  R2_ACCESS_KEY_ID=your_access_key
  R2_SECRET_ACCESS_KEY=your_secret_key
  R2_BUCKET_NAME=spell-artifacts
  R2_PUBLIC_URL=https://artifacts.yourdomain.com
  ```
- [ ] Add R2 credentials to staging `.env`
- [ ] Verify all environment variables are set correctly
- [ ] Test R2 connection from staging environment

### 3. Database Migration
- [ ] Review Prisma schema changes:
  - `artifactStorageKey` String?
  - `artifactSize` Int?
  - `artifactContentType` String?
  - Index on `artifactStorageKey`
- [ ] Generate migration: `npx prisma migrate dev --name add_artifact_storage_fields`
- [ ] Review generated SQL migration
- [ ] Test migration on staging database
- [ ] Backup production database
- [ ] Run migration on production: `npx prisma migrate deploy`
- [ ] Verify migration success
- [ ] Generate Prisma client: `npx prisma generate`

### 4. Code Review
- [ ] Review all new files:
  - [ ] `/src/lib/storage.ts`
  - [ ] `/src/lib/artifact-cleanup.ts`
  - [ ] `/src/app/api/artifacts/[castId]/[filename]/route.ts`
  - [ ] `/src/app/api/artifacts/route.ts`
  - [ ] `/scripts/migrate-artifacts-to-r2.ts`
  - [ ] `/tests/lib/storage.test.ts`
- [ ] Review modified files:
  - [ ] `/prisma/schema.prisma`
  - [ ] `.env.example`
  - [ ] `/src/lib/audit-log.ts`
  - [ ] `/src/lib/github-app.ts`
  - [ ] `/src/app/api/webhooks/github/route.ts`
  - [ ] `/src/components/cast-detail-client.tsx`
- [ ] Run TypeScript type checking: `npm run typecheck`
- [ ] Run linter: `npm run lint`
- [ ] Fix any type errors or lint warnings

### 5. Testing
- [ ] Run unit tests: `npm test tests/lib/storage.test.ts`
- [ ] Test locally with R2 credentials:
  - [ ] Create test bucket
  - [ ] Test artifact upload
  - [ ] Test artifact download
  - [ ] Test signed URL generation
  - [ ] Test artifact deletion
  - [ ] Test access control
- [ ] Test on staging environment:
  - [ ] Trigger GitHub workflow
  - [ ] Verify artifact upload to R2
  - [ ] Verify artifact download via API
  - [ ] Test unauthorized access (should fail)
  - [ ] Verify audit logs
- [ ] Performance testing:
  - [ ] Upload large file (>100MB)
  - [ ] Download large file
  - [ ] Test concurrent uploads
  - [ ] Test concurrent downloads

## Deployment

### 6. Deploy to Staging
- [ ] Build application: `npm run build`
- [ ] Deploy to staging server
- [ ] Verify deployment successful
- [ ] Check application logs for errors
- [ ] Test end-to-end workflow:
  - [ ] Create test spell
  - [ ] Trigger cast execution
  - [ ] Wait for workflow completion
  - [ ] Verify artifact uploaded to R2
  - [ ] Download artifact via UI
  - [ ] Check audit logs

### 7. Monitoring Setup
- [ ] Set up alerts for:
  - [ ] Upload failures
  - [ ] Download failures
  - [ ] High storage usage
  - [ ] Access denied attempts
- [ ] Configure log aggregation:
  - [ ] Artifact upload logs
  - [ ] Artifact download logs
  - [ ] Error logs
- [ ] Set up dashboards:
  - [ ] Storage usage over time
  - [ ] Upload/download rates
  - [ ] Error rates
  - [ ] Cost tracking

### 8. Deploy to Production
- [ ] Create deployment plan with rollback strategy
- [ ] Schedule maintenance window if needed
- [ ] Deploy code to production
- [ ] Run database migration (if not done)
- [ ] Verify environment variables
- [ ] Monitor logs for first 30 minutes
- [ ] Test with production cast
- [ ] Verify artifact storage and retrieval

## Post-Deployment

### 9. Migration of Existing Artifacts
- [ ] Backup existing Cast records
- [ ] Test migration script on subset:
  ```bash
  tsx scripts/migrate-artifacts-to-r2.ts --dry-run --limit=10
  ```
- [ ] Review dry-run results
- [ ] Migrate small batch:
  ```bash
  tsx scripts/migrate-artifacts-to-r2.ts --batch-size=10 --limit=100
  ```
- [ ] Verify migrated artifacts accessible
- [ ] Continue migration in batches:
  ```bash
  tsx scripts/migrate-artifacts-to-r2.ts --batch-size=50
  ```
- [ ] Monitor error logs during migration
- [ ] Handle any failed migrations manually
- [ ] Verify all artifacts migrated
- [ ] Update any hardcoded references to old URLs

### 10. Cleanup Configuration
- [ ] Set up cron job for daily cleanup:
  ```typescript
  // Run daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    await cleanupOldArtifacts(90);
    await cleanupFailedCasts(7);
  });
  ```
- [ ] Test cleanup in staging first
- [ ] Enable cleanup in production
- [ ] Monitor cleanup logs
- [ ] Adjust retention policies as needed

### 11. Documentation Update
- [ ] Update internal wiki with R2 setup
- [ ] Document environment variables
- [ ] Add troubleshooting guide to runbook
- [ ] Update API documentation
- [ ] Create user guide for artifact downloads
- [ ] Update cost tracking documentation

### 12. Team Training
- [ ] Share R2 integration documentation with team
- [ ] Demonstrate artifact upload/download flow
- [ ] Explain access control model
- [ ] Review audit logging
- [ ] Train on troubleshooting procedures
- [ ] Document common issues and solutions

## Validation

### 13. Functional Testing
- [ ] Create new spell
- [ ] Execute cast
- [ ] Verify artifact upload:
  - [ ] Check R2 console
  - [ ] Verify database record updated
  - [ ] Check audit log entry
- [ ] Download artifact:
  - [ ] As cast owner
  - [ ] As spell author
  - [ ] As public user (if public spell)
- [ ] Test access control:
  - [ ] Unauthorized download (should fail)
  - [ ] Expired signed URL (should fail after 1 hour)
- [ ] Delete artifact:
  - [ ] Via API
  - [ ] Verify removed from R2
  - [ ] Verify database updated
  - [ ] Check audit log

### 14. Performance Validation
- [ ] Upload speed acceptable (<30s for typical artifacts)
- [ ] Download speed acceptable
- [ ] Signed URL generation fast (<100ms)
- [ ] No impact on webhook response time
- [ ] API response times acceptable

### 15. Security Validation
- [ ] Path traversal prevented
- [ ] Dangerous characters filtered
- [ ] Signed URLs expire correctly
- [ ] Unauthorized access blocked
- [ ] Audit logs capturing all events
- [ ] No sensitive data in logs

### 16. Cost Validation
- [ ] Storage costs within budget
- [ ] No unexpected charges
- [ ] Cost tracking working correctly
- [ ] Budget system updated properly

## Monitoring (First Week)

### 17. Daily Checks
Day 1:
- [ ] Check error logs (morning, afternoon, evening)
- [ ] Verify artifact uploads working
- [ ] Monitor storage usage
- [ ] Review audit logs for anomalies

Day 2:
- [ ] Check error logs
- [ ] Verify no failed uploads
- [ ] Monitor download performance
- [ ] Review cost metrics

Day 3:
- [ ] Check error logs
- [ ] Run storage analytics
- [ ] Review top users by storage
- [ ] Verify cleanup jobs running

Day 4-7:
- [ ] Daily error log review
- [ ] Monitor storage growth
- [ ] Check for performance issues
- [ ] Review user feedback

### 18. Weekly Review
- [ ] Analyze error patterns
- [ ] Review storage usage trends
- [ ] Calculate actual costs vs estimates
- [ ] Identify optimization opportunities
- [ ] Update documentation based on issues found
- [ ] Plan improvements for next sprint

## Rollback Plan

### 19. Rollback Preparation
- [ ] Document current state before deployment
- [ ] Create database backup
- [ ] Tag current production deployment
- [ ] Document rollback steps

### 20. Rollback Triggers
Rollback if:
- [ ] Upload success rate < 95%
- [ ] Download success rate < 99%
- [ ] Critical security issue discovered
- [ ] Database corruption
- [ ] Unacceptable performance degradation
- [ ] Unexpected high costs

### 21. Rollback Procedure
If rollback needed:
1. [ ] Stop new deployments
2. [ ] Revert code to previous version
3. [ ] Restore database if needed (keep new fields)
4. [ ] Clear application cache
5. [ ] Restart services
6. [ ] Verify old behavior working
7. [ ] Keep R2 artifacts (they can still be used)
8. [ ] Document rollback reason
9. [ ] Create incident report
10. [ ] Plan fix for next deployment

## Success Criteria

### 22. Deployment Success Metrics
- [ ] Zero critical errors in first 24 hours
- [ ] Upload success rate > 99%
- [ ] Download success rate > 99.9%
- [ ] Average upload time < 30 seconds
- [ ] Average download time acceptable
- [ ] No security incidents
- [ ] Audit logs working correctly
- [ ] Cost within estimates
- [ ] User feedback positive
- [ ] Team confident in new system

### 23. Sign-off
- [ ] Product Manager approval
- [ ] Engineering Manager approval
- [ ] DevOps approval
- [ ] Security team approval
- [ ] Deployment marked as successful

## Notes

### Issues Encountered
```
Date: ___________
Issue: ___________
Resolution: ___________
```

### Improvements Identified
```
Date: ___________
Improvement: ___________
Priority: ___________
```

### Lessons Learned
```
What went well:
- ___________
- ___________

What could be improved:
- ___________
- ___________

Action items:
- ___________
- ___________
```

---

**Deployment Date**: ___________
**Deployed By**: ___________
**Sign-off Date**: ___________
**Signed-off By**: ___________
