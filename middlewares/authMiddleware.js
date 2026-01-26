const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const privateKey = fs.readFileSync(path.join(__dirname, '../helpers/admin.key'), 'utf8');

require('dotenv').config();
const validApiKeys = [process.env.X_API_KEY];

const ROLES = {
  Gestor: 'Gestor',
  Organizacion: 'Organización',
  Coordinador: 'Coordinador',
  Revisor: 'Revisor',
  Director_Unidad: 'Director Unidad',
  Director_General: 'Director General',
};

/**
 * Función factoría de Middleware: Genera una función de middleware de autenticación
 * que también verifica el rol del usuario contra una lista de roles permitidos.
 *
 * @param {string[]} [allowedRoles=[]] - Un array de roles permitidos. Si está vacío,
 * solo se verifica que el usuario esté autenticado.
 * @returns {Function} La función de middleware de Express.
 */
function authMiddleware(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      const apiKey = req.headers['api_key'];
      if (!apiKey || !validApiKeys.includes(apiKey)) {
        return res.status(401).json({ message: 'Acceso denegado. API key inválida o faltante.' });
      }

      const authHeader = req.headers['authorization'] || req.headers['Authorization'];
      if (!authHeader) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere token.' });
      }

      const [scheme, token] = authHeader.split(' ');
      if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Formato de token inválido.' });
      }

      const decoded = jwt.verify(token, privateKey, {
        algorithms: ['RS256'],
      });

      req.user = decoded;

      if (allowedRoles.length > 0) {
        const userRole = decoded.rol;

        if (!allowedRoles.includes(userRole)) {
          return res.status(403).json({ 
            message: `Acceso denegado. Rol '${userRole}' no autorizado para esta ruta.`,
          });
        }
      }

      next();
    } catch (err) {
      console.error('Error al verificar la autenticación:', err.message);
      return res.status(401).json({ message: 'Token inválido o expirado.' });
    }
  };
}

module.exports = {
  authMiddleware,
  ROLES,
};