#!/usr/bin/env bash
# Start the local dev Postgres (cluster lives in .pgdata, port 54329). First run: initdb -D .pgdata -U jurnal --auth=trust
export PATH=/usr/lib/postgresql/17/bin:$PATH
pg_ctl -D "$(dirname "$0")/../.pgdata" -o "-p 54329 -k /tmp -c listen_addresses=localhost" -l "$(dirname "$0")/../.pgdata/log.txt" start
