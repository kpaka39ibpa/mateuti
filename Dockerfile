FROM php:8.2-apache

COPY . /var/www/html/

RUN mkdir -p /var/www/html/data /var/www/html/archive && \
    chown -R www-data:www-data /var/www/html/

EXPOSE 80
