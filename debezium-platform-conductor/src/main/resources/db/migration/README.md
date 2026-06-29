# Database migrations

This directory contains Flyway SQL migrations for the conductor database.

## Naming convention

Migration files must follow Flyway's versioned migration naming format: 
```text
V<version>__<description>.sql
```

Examples:
```text
V3.1.0__initial_database.sql
V3.3.0__add_detailed_logs.sql
```

The version determines the order in which Flyway applies migrations. The description should briefly explain what the migration does, using lowercase words separated by underscores.

## Do not modify applied migrations

Once a migration has been applied to any shared, test, staging, or production database, do not edit it.

Flyway stores a checksum for each applied migration in the database schema history table. If the contents of an already-applied migration file change, Flyway validation will fail on startup because the checksum no longer matches.

Instead, create a new migration with the next version number.

For example, if this migration has already been applied: 

```text
V3.6.0__create_heartbeat_table.sql
```
do not append new SQL to it. Create a new migration instead, such as:
```text
V3.6.0.1__fix_connection_sequence_increment.sql
```