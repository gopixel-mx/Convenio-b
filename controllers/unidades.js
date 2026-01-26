const db = require("../config/mysql");


const getUnidades = async (req, res) => {
    const con = await db.getConnection();
    const X_API_KEY = req.headers['api_key'];
    if (X_API_KEY !== process.env.X_API_KEY) {
        return res.status(401).json({ ok: false, msg: 'Falta api key' });
    }
    try {
        const [unidades] = await con.query("SELECT * FROM Unidades_Academicas");
        return res.status(200).json({ unidades });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

module.exports = {
    getUnidades
}