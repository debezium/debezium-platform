CREATE TABLE IF NOT EXISTS heartbeat (
    id INTEGER PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT now()
);

-- Host-based pipeline deployment tables
-- Purely additive: no changes to existing tables, sequences, indexes, or constraints.

create sequence host_status_SEQ start with 1 increment by 50;

create sequence host_deployment_SEQ start with 1 increment by 50;

create table host_status (
    id bigint not null,
    ssh_alias varchar(255) not null unique,
    hostname varchar(255) not null,
    provisioning_status varchar(255) not null,
    provisioning_report text,
    agent_port integer not null,
    agent_token varchar(255),
    last_checked_at timestamp(6) with time zone,
    primary key (id)
);

create table host_deployment (
    id bigint not null,
    pipeline_id bigint not null unique,
    host_status_id bigint not null,
    container_name varchar(255) not null,
    image_version varchar(255) not null,
    server_port integer not null,
    deployment_status varchar(255) not null,
    config_hash varchar(255) not null,
    primary key (id)
);

alter table if exists host_deployment
    add constraint FK_host_deployment_pipeline
    foreign key (pipeline_id)
    references pipeline;

alter table if exists host_deployment
    add constraint FK_host_deployment_host_status
    foreign key (host_status_id)
    references host_status;

create index idx_host_deployment_host_status_id on host_deployment (host_status_id);

create index idx_host_deployment_deployment_status on host_deployment (deployment_status);
