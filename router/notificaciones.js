const { Router } = require("express");
const { 
    crearNotificacion, 
    obtenerNotificaciones, 
    obtenerNotificacionOne, 
    marcarComoEntregada,
    marcarVariasComoEntregadas,
    eliminarNotificacion,
    obtenerNotificacionesPorUsuario 
} = require("../controllers/notificaciones");
const { authMiddleware, ROLES } = require("../middlewares/authMiddleware");

const routerNotificaciones = Router();

// Crear una notificación
routerNotificaciones.post('/', authMiddleware(), crearNotificacion);

// Obtener todas las notificaciones (con filtros opcionales)
routerNotificaciones.get('/', authMiddleware(), obtenerNotificaciones);

// Obtener notificaciones de un usuario específico
routerNotificaciones.get('/usuario/:id_cuenta', authMiddleware(), obtenerNotificacionesPorUsuario);

// Obtener una notificación por ID
routerNotificaciones.get('/:id', authMiddleware(), obtenerNotificacionOne);

// Marcar una notificación como entregada
routerNotificaciones.patch('/:id/entregada', authMiddleware(), marcarComoEntregada);

// Marcar varias notificaciones como entregadas
routerNotificaciones.patch('/entregadas', authMiddleware(), marcarVariasComoEntregadas);

// Eliminar una notificación
routerNotificaciones.delete('/:id', authMiddleware(), eliminarNotificacion);

module.exports = (app) => app.use('/notificaciones', routerNotificaciones);
