# Use official PHP image with Apache
FROM php:8.2-apache

# Install PDO MySQL extension for database connection
RUN docker-php-ext-install pdo_mysql

# Enable Apache mod_rewrite for route handling
RUN a2enmod rewrite

# Copy all project files to Apache document root
COPY . /var/www/html/

# Ensure proper permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port 80 (Apache default)
EXPOSE 80
