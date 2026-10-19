# Canonical demo foundation

## Current protection boundary

HFHS, CCPS and Rubber World are protected active opportunities. They remain in the shared Vivid Routing production deployment until each can be migrated individually after the new demo environment passes isolation testing. No canonical-demo work may seed, rename, reconfigure or query those tenants.

The current production `start` command runs code installers and customer-specific seed scripts on every deployment. The `npm run audit:demo-isolation` report intentionally fails while those steps remain. It is an audit signal, not a production startup replacement.

## Target boundary

Every generated demo uses:

1. The shared, versioned Vivid application code.
2. A dedicated non-production Railway project.
3. A dedicated demo PostgreSQL database.
4. A manifest that configures branding, terminology and modules.
5. Three connected surfaces: organization, marketplace and advertiser.
6. Synthetic data labeled `Illustrative sample data`.
7. A private review token and tenant-scoped session.
8. No email, payment, OAuth or live marketing connector credentials.

The first isolated control plane is now provisioned:

- Project: `vivid-canonical-demo` (`e02ba0e0-4faf-41eb-a81d-d53b94ee1019`)
- Environment: `demo` (`247466bb-3b21-4f93-bb85-2e04babbe88b`)
- Database service: `Postgres` (`93db3daf-731d-43bf-8990-18d385ae0b09`)
- Application service: `canonical-vivid-demo` (`f4252a91-b9fc-4b27-a6fa-2351446ba46a`)
- Application status: empty and source-unconnected; its safe start command and `/health` check are configured, but it cannot deploy until the database fingerprint and startup audit pass

The canonical application now includes an isolated sample-only schema for organizations, locations, inventory, Marketplace requests, advertisers, contracts, campaigns and performance. Every business table enforces `is_sample = TRUE`. The database also stores the approved project, environment, database service and tenant identity; startup fails if any value differs.

The first connected experience provides:

- Organization executive metrics, location inventory, contracts and renewals
- Public Marketplace availability, pricing and an internal-only sample request flow
- Advertiser campaign metrics for scans, actions, conversions, revenue and ROI
- CSV performance export
- Private review-token access and `noindex` headers

## Runtime variables

The canonical runtime refuses to start unless all of these conditions are met:

- `DEMO_PLATFORM_ISOLATED=1`
- `DEMO_ENVIRONMENT_KIND=demo`
- `DEMO_PROJECT_ID` exactly matches `RAILWAY_PROJECT_ID`
- `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID` and `DEMO_DATABASE_SERVICE_ID` match the approved registry
- The Railway project is not in `demo-platform/protected-resources.json`
- `DEMO_TENANT_SLUG` matches the manifest
- `DEMO_DATABASE_FINGERPRINT` matches `DATABASE_URL`
- A sufficiently long review token and session secret are present
- Production email, payment and marketing secrets are absent

Generate a database fingerprint without printing credentials:

```bash
node -e "console.log(require('./demo-platform/runtime-guard').databaseFingerprint(process.env.DATABASE_URL))"
```

## Delivery phases

1. Freeze and audit HFHS, CCPS and Rubber World.
2. Provision the isolated canonical-demo project and database.
3. Move stable platform modules behind configuration instead of source installers.
4. Run the canonical template locally and in the isolated environment.
5. Rebuild Rubber World from the template without touching its active demo.
6. Rebuild a school demo from the same template.
7. Resume demo creation only after cross-tenant and external-effect tests pass.
8. Add Apollo after demo creation and isolation are stable.

Run `npm run audit:protected-demos` before every commit. It rejects changes to files whose names identify HFHS, Rubber World or CCPS. The production-start audit is expected to remain red until customer-specific installers and seed scripts are removed from application startup.

## Definition of done

A prospect demo can be created from a manifest without modifying source code, production data or another demo. The organization, marketplace and advertiser surfaces share only that demo's tenant data. The workspace can be deleted and recreated without affecting any other service.
