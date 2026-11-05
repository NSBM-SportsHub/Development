#!/bin/sh
set -eu
port="${PORT:-10000}"
case "$port" in ''|*[!0-9]*) echo "PORT must be numeric." >&2; exit 1;; esac
if [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then echo "PORT is out of range." >&2; exit 1; fi
sed -i "s/^Listen 80$/Listen $port/" /etc/apache2/ports.conf
sed -i "s/VirtualHost \*:80/VirtualHost *:$port/" /etc/apache2/sites-available/000-default.conf
if [ "${SPORTSHUB_AUTO_SETUP:-1}" = "1" ]; then
    php /var/www/html/backend/bin/setup.php --existing-database --reference-seed
fi
exec apache2-foreground
