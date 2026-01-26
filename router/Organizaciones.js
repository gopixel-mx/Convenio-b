const { Router } = require("express");
const { authMiddleware, ROLES } = require("../middlewares/authMiddleware");
const { registrarOrganizacion, procesarArchivo, actualizarOrganizacion } = require("../controllers/Organizaciones");
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const routerOrganizacion = Router();

routerOrganizacion.post('/', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Director_Unidad, ROLES.Coordinador, ROLES.Director_General]), registrarOrganizacion);
routerOrganizacion.patch('/:id_Organizacion', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Director_Unidad, ROLES.Coordinador, ROLES.Director_General]), actualizarOrganizacion);
routerOrganizacion.post('/archivo', upload.single('document'), procesarArchivo);

module.exports = (app) => app.use('/organizacion', routerOrganizacion);