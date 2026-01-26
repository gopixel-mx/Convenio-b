-- Actualizar la tabla Notificaciones para soportar más tipos y aumentar el tamaño de las columnas

-- Modificar el enum 'tipo' para incluir 'correccion'
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `tipo` enum('sistema','validacion','correccion') NOT NULL DEFAULT 'validacion';

-- Aumentar el tamaño de la columna titulo de 50 a 100
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `titulo` varchar(100) DEFAULT NULL;

-- Aumentar el tamaño de la columna contenido de 250 a 800
ALTER TABLE `Notificaciones` 
MODIFY COLUMN `contenido` varchar(800) DEFAULT NULL;
