const { Router } = require("express");
const { Logg } = require('../controllers/login');

const routerLogin = Router();

routerLogin.post('/', Logg);

module.exports = (app) => app.use('/login',routerLogin);