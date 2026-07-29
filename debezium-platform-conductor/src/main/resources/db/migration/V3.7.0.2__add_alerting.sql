create sequence notification_channel_SEQ start with 1 increment by 50;

create sequence alert_rule_SEQ start with 1 increment by 50;

create sequence alert_event_SEQ start with 1 increment by 50;

create sequence alert_state_SEQ start with 1 increment by 50;

create table notification_channel (
    id          bigint not null,
    name        varchar(253) not null unique,
    type        varchar(50) not null,
    config      jsonb not null default '{}',
    enabled     boolean not null default true,
    created_at  timestamp with time zone not null default now(),
    updated_at  timestamp with time zone not null default now(),
    primary key (id)
);

create table alert_rule (
    id                  bigint not null,
    name                varchar(253) not null unique,
    description         text,
    panel_id            varchar(255) not null,
    operator            varchar(30) not null,
    threshold           double precision not null,
    for_duration        varchar(30) not null default 'PT0S',
    reduce_function     varchar(10) not null default 'LAST',
    evaluation_window   varchar(30) not null default 'PT5M',
    severity            varchar(20) not null default 'WARNING',
    enabled             boolean not null default true,
    created_at          timestamp with time zone not null default now(),
    updated_at          timestamp with time zone not null default now(),
    primary key (id)
);

create table alert_rule_channel (
    rule_id     bigint not null,
    channel_id  bigint not null,
    primary key (rule_id, channel_id)
);

create table alert_event (
    id              bigint not null,
    rule_id         bigint,
    rule_name       varchar(253) not null,
    pipeline_id     varchar(255) not null,
    pipeline_name   varchar(255),
    value           double precision,
    threshold       double precision not null,
    severity        varchar(20) not null,
    message         text,
    fired_at        timestamp with time zone not null,
    resolved_at     timestamp with time zone,
    created_at      timestamp with time zone not null default now(),
    primary key (id)
);

create table alert_state (
    id                bigint not null,
    rule_id           bigint not null,
    pipeline_id       varchar(255) not null,
    state             varchar(20) not null default 'OK',
    value             double precision,
    pending_since     timestamp with time zone,
    fired_at          timestamp with time zone,
    active_event_id   bigint,
    last_evaluated_at timestamp with time zone,
    primary key (id),
    unique (rule_id, pipeline_id)
);

alter table if exists alert_rule_channel
    add constraint FK_alert_rule_channel_rule
    foreign key (rule_id)
    references alert_rule
    on delete cascade;

alter table if exists alert_rule_channel
    add constraint FK_alert_rule_channel_channel
    foreign key (channel_id)
    references notification_channel
    on delete cascade;

alter table if exists alert_event
    add constraint FK_alert_event_rule
    foreign key (rule_id)
    references alert_rule
    on delete set null;

alter table if exists alert_state
    add constraint FK_alert_state_rule
    foreign key (rule_id)
    references alert_rule
    on delete cascade;

alter table if exists alert_state
    add constraint FK_alert_state_event
    foreign key (active_event_id)
    references alert_event
    on delete set null;

create index idx_alert_event_rule on alert_event(rule_id);
create index idx_alert_event_pipeline on alert_event(pipeline_id);
create index idx_alert_event_created on alert_event(created_at);
create index idx_alert_event_resolved on alert_event(resolved_at);
create index idx_alert_state_rule on alert_state(rule_id);
