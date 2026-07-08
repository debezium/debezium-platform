ALTER TABLE pipeline
    ADD COLUMN status VARCHAR(255);

ALTER TABLE pipeline
    ADD COLUMN error_message TEXT;