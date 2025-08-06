ALTER TABLE pipeline RENAME COLUMN logLevel TO default_log_level;

CREATE TABLE pipeline_log_levels (
    pipeline_id BIGINT NOT NULL,
    category VARCHAR(255) NOT NULL,
    level VARCHAR(255),
    PRIMARY KEY (pipeline_id, category),
    CONSTRAINT fk_pipeline_log_levels_pipeline
        FOREIGN KEY (pipeline_id) REFERENCES pipeline (id)
        ON DELETE CASCADE
);

create sequence connection_seq start with 1 increment by 1;

create table connection (
    id bigint not null default nextval('connection_seq'),
    name varchar(255) not null unique,
    type varchar(255) not null,
    config jsonb,
    primary key (id)
);