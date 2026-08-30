-- Add missing deployed_at column to host_deployment table

alter table if exists host_deployment
    add column if not exists deployed_at timestamp(6) with time zone not null default now();

alter table if exists host_deployment
    drop constraint if exists FK_host_deployment_pipeline;

alter table if exists host_deployment
    add constraint FK_host_deployment_pipeline
    foreign key (pipeline_id)
    references pipeline;
