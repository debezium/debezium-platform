create sequence destination_SEQ start with 1 increment by 50;

create sequence pipeline_SEQ start with 1 increment by 50;

create sequence source_SEQ start with 1 increment by 50;

create sequence transform_SEQ start with 1 increment by 50;

create sequence vault_SEQ start with 1 increment by 50;

create table destination (
    id bigint not null,
    description varchar(255),
    name varchar(255) not null unique,
    schema varchar(255) not null,
    type varchar(255) not null,
    config jsonb,
    primary key (id)
);

create table destination_vault (
    destination_id bigint not null,
    vault_id bigint not null,
    primary key (destination_id, vault_id)
);

create table events (
    timestamp timestamp(6) with time zone not null,
    id uuid not null,
    tracingspancontext varchar(256),
    aggregateid varchar(255) not null,
    aggregatetype varchar(255) not null,
    payload varchar(8000),
    type varchar(255) not null,
    primary key (id)
);

create table pipeline (
    destination_id bigint,
    id bigint not null,
    source_id bigint,
    description varchar(255),
    logLevel varchar(255),
    name varchar(255) not null unique,
    primary key (id)
);

create table pipeline_transform (
    transforms_ORDER integer not null,
    pipeline_id bigint not null,
    transform_id bigint not null,
    primary key (transforms_ORDER, pipeline_id)
);

create table source (
    id bigint not null,
    description varchar(255),
    name varchar(255) not null unique,
    schema varchar(255) not null,
    type varchar(255) not null,
    config jsonb,
    primary key (id)
);

create table source_vault (
    source_id bigint not null,
    vault_id bigint not null,
    primary key (source_id, vault_id)
);

create table transform (
    id bigint not null,
    description varchar(255),
    name varchar(255) not null unique,
    schema varchar(255) not null,
    type varchar(255) not null,
    config jsonb,
    predicate_type VARCHAR(255),
    predicate_config JSONB,
    predicate_negate BOOLEAN,
    primary key (id)
);

create table transform_vault (
    transform_id bigint not null,
    vault_id bigint not null,
    primary key (transform_id, vault_id)
);

create table vault (
    plaintext boolean not null,
    id bigint not null,
    description varchar(255),
    name varchar(255) not null unique,
    items jsonb,
    primary key (id)
);

alter table if exists destination_vault
   add constraint FK_destination_vault_vault
   foreign key (vault_id)
   references vault;

alter table if exists destination_vault
   add constraint FK_destination_vault_destination
   foreign key (destination_id)
   references destination;

alter table if exists pipeline
   add constraint FK_pipeline_destination
   foreign key (destination_id)
   references destination;

alter table if exists pipeline
   add constraint FK_pipeline_source
   foreign key (source_id)
   references source;

alter table if exists pipeline_transform
   add constraint FK_pipeline_transform_transform
   foreign key (transform_id)
   references transform;

alter table if exists pipeline_transform
   add constraint FK_pipeline_transform_pipeline
   foreign key (pipeline_id)
   references pipeline;

alter table if exists source_vault
   add constraint FK_source_vault_vault
   foreign key (vault_id)
   references vault;

alter table if exists source_vault
   add constraint FK_source_vault_source
   foreign key (source_id)
   references source;

alter table if exists transform_vault
   add constraint FK_transform_vault_vault
   foreign key (vault_id)
   references vault;

alter table if exists transform_vault
   add constraint FK_transform_vault_transform
   foreign key (transform_id)
   references transform;
