const { Router } = require("express");
const { subirDocumentos, tiposDocumentos, obtenerAnexos, deleteAnexo, descargarAnexo } = require('../controllers/media');
const { uploadMultipleFields } = require('../middlewares/multerMiddleware');

const routerMedia = Router();

routerMedia.post('/upload', uploadMultipleFields, subirDocumentos);
routerMedia.get('/tipos', tiposDocumentos);
routerMedia.get('/anexo/:idConvenio', obtenerAnexos);
routerMedia.delete('/anexo/:idAnexo', deleteAnexo);
routerMedia.get('/download/:idConvenio/:docKey', descargarAnexo);

module.exports = (app) => {
    app.use('/media', routerMedia);
};
