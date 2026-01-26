const { Router } = require("express");
const { getUnidades } = require("../controllers/unidades");

const routerUnidades = Router();

routerUnidades.get('/', getUnidades);

module.exports = (app) => app.use('/unidades',routerUnidades);