#!/bin/bash
# Runs once on first container start (when the data volume is empty).
# Creates the action_pool database alongside the default typercut database.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE action_pool;
    GRANT ALL PRIVILEGES ON DATABASE action_pool TO $POSTGRES_USER;
EOSQL
