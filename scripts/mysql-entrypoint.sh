#!/bin/sh
set -eu
umask 077
# The application password is persisted alongside (but outside) the database.
if [ -z "${MYSQL_PASSWORD:-}" ]; then
    if [ ! -s /run/studio/password ]; then
        openssl rand -hex 24 > /run/studio/password
        chmod 444 /run/studio/password
    fi
    export MYSQL_PASSWORD="$(cat /run/studio/password)"
fi
if [ -z "${MYSQL_ROOT_PASSWORD:-}" ]; then
    export MYSQL_ROOT_PASSWORD="$(openssl rand -hex 32)"
fi
exec /usr/local/bin/docker-entrypoint.sh mysqld
