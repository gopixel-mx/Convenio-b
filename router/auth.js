const { Router } = require("express");
const {authMiddleware} = require('../middlewares/authMiddleware');
const { handleTokenVerification } = require('../controllers/authController');

const routerAuth = Router();

// Ruta protegida para verificar token
routerAuth.get('/verify-token', authMiddleware(), handleTokenVerification);

module.exports = (app) => app.use('/auth',routerAuth);
