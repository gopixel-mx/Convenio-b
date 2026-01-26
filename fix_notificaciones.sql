-- Script para verificar y actualizar la tabla Notificaciones

-- Primero, verifica la estructura actual
SHOW CREATE TABLE Notificaciones;

-- Si ves que el enum no tiene 'correccion', ejecuta estos comandos:

-- Opción 1: Modificar el enum existente
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `tipo` enum('sistema','validacion','correccion') NOT NULL DEFAULT 'validacion';

-- Opción 2: Si la Opción 1 no funciona, usa este método:
-- Primero cambia a VARCHAR temporalmente
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `tipo` VARCHAR(20) NOT NULL DEFAULT 'validacion';

-- Luego cambia de vuelta a enum con los valores nuevos
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `tipo` enum('sistema','validacion','correccion') NOT NULL DEFAULT 'validacion';

-- Actualizar también los tamaños de las columnas
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `titulo` varchar(100) DEFAULT NULL;

ALTER TABLE `Notificaciones` 
MODIFY COLUMN `contenido` varchar(800) DEFAULT NULL;

-- Verificar los cambios
DESCRIBE Notificaciones;
