FROM php:8.3-apache
RUN apt-get update && apt-get install -y --no-install-recommends libonig-dev \
    && docker-php-ext-install pdo_mysql mbstring \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /var/www/html
COPY backend ./backend
COPY database ./database
COPY deployment/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deployment/start-backend.sh /usr/local/bin/start-sportshub
RUN sed -i 's/\r$//' /usr/local/bin/start-sportshub \
    && chmod +x /usr/local/bin/start-sportshub \
    && mkdir -p backend/var/sessions \
    && chown -R www-data:www-data backend/var \
    && printf 'expose_php=Off\ndisplay_errors=Off\nlog_errors=On\nsession.use_strict_mode=1\n' > /usr/local/etc/php/conf.d/sportshub.ini
ENV SPORTSHUB_ENV=production SPORTSHUB_SESSION_SECURE=1 SPORTSHUB_SESSION_PATH=/var/www/html/backend/var/sessions
EXPOSE 10000
CMD ["/usr/local/bin/start-sportshub"]
