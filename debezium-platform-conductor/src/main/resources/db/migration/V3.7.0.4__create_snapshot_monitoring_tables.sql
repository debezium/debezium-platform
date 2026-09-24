create sequence active_snapshot_SEQ start with 1 increment by 50;

create sequence active_snapshot_table_SEQ start with 1 increment by 50;

create sequence snapshot_history_SEQ start with 1 increment by 50;

create sequence snapshot_table_history_SEQ start with 1 increment by 50;

create table active_snapshot (
    id               bigint not null,
    pipeline_id      bigint not null unique,
    type             varchar(20) not null,
    status           varchar(20) not null,
    correlation_id   varchar(255),
    total_tables     integer not null default 0,
    started_at       timestamp with time zone not null,
    last_updated_at  timestamp with time zone not null,
    primary key (id)
);

create table active_snapshot_table (
    id                  bigint not null,
    active_snapshot_id  bigint not null,
    table_name          varchar(512) not null,
    state               varchar(20) not null,
    order_index         integer not null,
    rows_scanned        bigint not null default 0,
    skip_reason         varchar(255),
    started_at          timestamp with time zone,
    completed_at        timestamp with time zone,
    primary key (id)
);

create table snapshot_history (
    id                  bigint not null,
    pipeline_id         bigint not null,
    pipeline_name       varchar(255),
    type                varchar(20) not null,
    outcome             varchar(20) not null,
    total_tables        integer not null default 0,
    completed_tables    integer not null default 0,
    total_rows_scanned  bigint not null default 0,
    started_at          timestamp with time zone not null,
    completed_at        timestamp with time zone not null,
    duration_seconds    bigint not null default 0,
    primary key (id)
);

create table snapshot_table_history (
    id                    bigint not null,
    snapshot_history_id   bigint not null,
    table_name            varchar(512) not null,
    outcome               varchar(20) not null,
    order_index           integer not null,
    rows_scanned          bigint not null default 0,
    skip_reason           varchar(255),
    duration_seconds      bigint,
    primary key (id)
);

alter table if exists active_snapshot_table
    add constraint FK_active_snapshot_table_snapshot
    foreign key (active_snapshot_id)
    references active_snapshot
    on delete cascade;

alter table if exists snapshot_table_history
    add constraint FK_snapshot_table_history_snapshot
    foreign key (snapshot_history_id)
    references snapshot_history
    on delete cascade;

create index idx_active_snapshot_pipeline on active_snapshot(pipeline_id);
create index idx_active_snapshot_table_snapshot on active_snapshot_table(active_snapshot_id);
create index idx_snapshot_history_pipeline on snapshot_history(pipeline_id);
create index idx_snapshot_history_completed on snapshot_history(completed_at);
create index idx_snapshot_table_history_snapshot on snapshot_table_history(snapshot_history_id);
