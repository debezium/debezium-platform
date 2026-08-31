-- Add missing deployed_at column to host_deployment table
-- Drop FK constraint: pipeline deletion must not be blocked by deployments.
-- The host service is responsible for undeploying and removing deployment records.

alter table if exists host_deployment
    add column if not exists deployed_at timestamp(6) with time zone not null default now();

alter table if exists host_deployment
    drop constraint if exists FK_host_deployment_pipeline;
