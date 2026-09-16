CREATE DATABASE IF NOT EXISTS solaces_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE solaces_inventory;

CREATE TABLE IF NOT EXISTS items (
  item_id VARCHAR(24) NOT NULL PRIMARY KEY,
  category VARCHAR(3) NOT NULL,
  size_label VARCHAR(50) NOT NULL, 
  price DECIMAL(10, 2) NOT NULL,
  status ENUM('UNSOLD', 'SOLD') NOT NULL DEFAULT 'UNSOLD',
  encoded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sold_at DATETIME NULL,
  INDEX idx_items_status (status),
  INDEX idx_items_category (category),
  INDEX idx_items_encoded_at (encoded_at)
);

CREATE TABLE IF NOT EXISTS sales (
  sale_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id VARCHAR(24) NOT NULL,
  category VARCHAR(3) NOT NULL,
  size_label VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  encoded_at DATETIME NOT NULL,
  sold_at DATETIME NOT NULL,
  UNIQUE KEY uq_sales_item (item_id),
  INDEX idx_sales_sold_at (sold_at),
  CONSTRAINT fk_sales_item FOREIGN KEY (item_id) REFERENCES items (item_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);
