const { Router } = require("express");
const { authMiddleware, ROLES } = require("../middlewares/authMiddleware");
const routerConvenios = Router();
const { draft, ActualizarDraft, obtenerConvenio, obtenerConvenios, convenioEmpresas, convenioDependencia, convenioPersona, generarPdf, enviarARevision, validarConvenio, validarCoordinador, requiereAjuste, solicitarCorreccion } = require("../controllers/convenios");


routerConvenios.get("/", authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Director_Unidad, ROLES.Coordinador, ROLES.Director_General]), obtenerConvenios);
routerConvenios.post('/draft', draft);
routerConvenios.patch('/draft', ActualizarDraft);
routerConvenios.get('/draft/:numeroConvenio', obtenerConvenio);
routerConvenios.post('/empresa', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Coordinador]), convenioEmpresas);
routerConvenios.post('/dependencia', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Coordinador]), convenioDependencia);
routerConvenios.post('/persona', authMiddleware([ROLES.Gestor, ROLES.Organizacion, ROLES.Revisor, ROLES.Coordinador]), convenioPersona);
routerConvenios.post('/pdf', generarPdf);
routerConvenios.post('/enviar-revision', enviarARevision);
routerConvenios.post('/validar', validarConvenio);
routerConvenios.post('/validar-coordinador', validarCoordinador);
routerConvenios.post('/requiere-ajuste', requiereAjuste);
routerConvenios.post('/solicitar-correccion', solicitarCorreccion);

module.exports = (app) => app.use('/convenios', routerConvenios);