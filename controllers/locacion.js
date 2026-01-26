const db = require("../config/mysql");

const obtenerEstados = async (req, res) => {
    const con = await db.getConnection();

    try {
        const [estados] = await con.query(
            "SELECT codigo AS value, nombre AS label FROM Estados WHERE codigo NOT IN('00', '99', '39')"
        );
        return res.status(200).json({ok: true, estados: estados});
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const obtenerMunicipios = async (req, res) => {
    const {id} = req.params;
    const con = await db.getConnection();
    try {
        const [municipios] = await con.query(
            "SELECT id_municipio AS value, nombre AS label FROM Municipios WHERE estado = ?",
            [id]
        );
        return res.status(200).json({ok: true, municipios: municipios});
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

module.exports = {
    obtenerEstados,
    obtenerMunicipios
}