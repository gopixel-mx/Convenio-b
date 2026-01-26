const { Router } = require("express");
const { authMiddleware, ROLES } = require("../middlewares/authMiddleware");
const { obtenerEstados, obtenerMunicipios } = require("../controllers/locacion");
const routerLocacion = Router();

routerLocacion.get('/estados', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Director_Unidad, ROLES.Coordinador, ROLES.Director_General]), obtenerEstados);
routerLocacion.get('/municipios/:id', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Director_Unidad, ROLES.Coordinador, ROLES.Director_General]), obtenerMunicipios)

module.exports = (app) => app.use('/locacion', routerLocacion);