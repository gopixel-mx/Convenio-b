const db = require("../config/mysql");
const jwt = require("../helpers/jwt");
const bycrypt = require("bcryptjs");

const Logg = async (req, res) => {
    const { mail, pass } = req.body;
    const con = await db.getConnection();
    const X_API_KEY = req.headers['api_key'];
    if (X_API_KEY !== process.env.X_API_KEY) {
        return res.status(401).json({ ok: false, msg: 'Falta api key' });
    }
    try {

        if (!mail || !pass ){
            return res.status(400).json({ok: false, msg: "Ambos campos son requeridos"})
        }
        const [Usuarios] = await con.query(
            "SELECT * FROM Cuentas WHERE correo = ? AND estado = 'Activo'",
            [mail]
        );

        if (Usuarios.length === 0) {
            return res.status(401).json({ ok: false, msg: "Usuario no encontrado o inactivo" });
        }

        const usuario = Usuarios[0];

        const match = bycrypt.compareSync(pass, usuario.contrasena);
        if (!match) {
            return res.status(401).json({ ok: false, msg: "Contraseña incorrecta" });
        }
        const result = jwt.signJwt({ id_Cuenta: usuario.id_Cuenta, rol: usuario.rol , id_Unidad_Academica: usuario.id_Unidad_Academica, nombre: usuario.nombre, correo: usuario.correo, rfc: usuario.rfc });
        return res.status(200).json({ token: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

module.exports = {
    Logg
} 