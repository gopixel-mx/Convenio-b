const db = require("../config/mysql");

const crearNotificacion = async (req, res) => {
    
    const { cuenta_Receptor, cuenta_Emisora, titulo, tipo, contenido } = req.body;
    const con = await db.getConnection();
    try {
        if (!cuenta_Receptor || !titulo || !contenido) {
            return res.status(400).json({ ok: false, message: "Los campos cuenta_Receptor, titulo y contenido son requeridos" });
        }
        const [receptor] = await con.query("SELECT id_Cuenta FROM Cuentas WHERE id_Cuenta = ?",[cuenta_Receptor]);
        if (receptor.length === 0) {
            return res.status(404).json({ ok: false, message: "La cuenta receptora no existe" });
        }
        if (cuenta_Emisora) {
            const [emisor] = await con.query("SELECT id_Cuenta FROM Cuentas WHERE id_Cuenta = ?",[cuenta_Emisora]);
            if (emisor.length === 0) {
                return res.status(404).json({ ok: false, message: "La cuenta emisora no existe" });
            }
        }
        const [result] = await con.query(
            "INSERT INTO Notificaciones (cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo, entregado, fecha_Creacion) VALUES (?, ?, ?, ?, ?, 0, NOW())",
            [cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo ]
        );        
        const notificacion = {
            id: result.insertId,
            cuenta_Receptor: cuenta_Receptor,
            cuenta_Emisora: cuenta_Emisora,
            titulo: titulo,
            contenido: contenido,
            tipo: tipo,
            entregado: 0,
            fecha_Creacion: new Date()
        };
        const io = req.app.get('socketio');
        io.to(`cuenta_${cuenta_Receptor}`).emit('nueva_notificacion', notificacion);

        return res.status(201).json({ 
            ok: true, 
            message: "Notificación creada exitosamente",
            id_Notificacion: result.insertId
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

const obtenerNotificaciones = async (req, res) => {
    const con = await db.getConnection();

    try {
        let { page = 1, limit = 10, cuenta_Receptor, entregado } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 10;

        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        if (cuenta_Receptor) {
            whereConditions.push("N.cuenta_Receptor = ?");
            queryParams.push(cuenta_Receptor);
        }

        if (entregado !== undefined) {
            whereConditions.push("N.entregado = ?");
            queryParams.push(entregado === 'true' || entregado === '1' ? 1 : 0);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const [countResult] = await con.query(
            `SELECT COUNT(*) AS total FROM Notificaciones N ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        const [notificaciones] = await con.query(
            `SELECT 
                N.id_Notificacion,
                N.cuenta_Receptor,
                N.cuenta_Emisora,
                N.titulo,
                N.contenido,
                N.entregado,
                N.fecha_Creacion,
                CR.nombre AS nombre_Receptor,
                CE.nombre AS nombre_Emisor
            FROM Notificaciones N
            LEFT JOIN Cuentas CR ON N.cuenta_Receptor = CR.id_Cuenta
            LEFT JOIN Cuentas CE ON N.cuenta_Emisora = CE.id_Cuenta
            ${whereClause}
            ORDER BY N.fecha_Creacion DESC
            LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            ok: true,
            total,
            page,
            totalPages,
            limit,
            data: notificaciones,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: "Algo salió mal" });
    } finally {
        con.release();
    }
};

const obtenerNotificacionOne = async (req, res) => {
    const { id } = req.params;
    const con = await db.getConnection();

    try {
        const [notificacion] = await con.query(
            `SELECT 
                N.id_Notificacion,
                N.cuenta_Receptor,
                N.cuenta_Emisora,
                N.titulo,
                N.contenido,
                N.entregado,
                N.fecha_Creacion,
                CR.nombre AS nombre_Receptor,
                CR.correo AS correo_Receptor,
                CE.nombre AS nombre_Emisor,
                CE.correo AS correo_Emisor
            FROM Notificaciones N
            LEFT JOIN Cuentas CR ON N.cuenta_Receptor = CR.id_Cuenta
            LEFT JOIN Cuentas CE ON N.cuenta_Emisora = CE.id_Cuenta
            WHERE N.id_Notificacion = ?`,
            [id]
        );

        if (notificacion.length === 0) {
            return res.status(404).json({ ok: false, message: "La notificación no existe" });
        }

        return res.status(200).json({ ok: true, data: notificacion[0] });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

const marcarComoEntregada = async (req, res) => {
    const { id } = req.params;
    const con = await db.getConnection();

    try {
        const [existingNotif] = await con.query(
            "SELECT id_Notificacion FROM Notificaciones WHERE id_Notificacion = ?",
            [id]
        );

        if (existingNotif.length === 0) {
            return res.status(404).json({ ok: false, message: "La notificación no existe" });
        }

        await con.query(
            "UPDATE Notificaciones SET entregado = 1 WHERE id_Notificacion = ?",
            [id]
        );

        return res.status(200).json({ ok: true, message: "Notificación marcada como entregada" });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

const marcarVariasComoEntregadas = async (req, res) => {
    const { ids } = req.body;
    const con = await db.getConnection();

    try {
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ ok: false, message: "Se requiere un array de IDs válido" });
        }

        const placeholders = ids.map(() => '?').join(',');
        await con.query(
            `UPDATE Notificaciones SET entregado = 1 WHERE id_Notificacion IN (${placeholders})`,
            ids
        );

        return res.status(200).json({ 
            ok: true, 
            message: `${ids.length} notificaciones marcadas como entregadas` 
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

const eliminarNotificacion = async (req, res) => {
    const { id } = req.params;
    const con = await db.getConnection();

    try {
        const [existingNotif] = await con.query(
            "SELECT id_Notificacion FROM Notificaciones WHERE id_Notificacion = ?",
            [id]
        );

        if (existingNotif.length === 0) {
            return res.status(404).json({ ok: false, message: "La notificación no existe" });
        }

        await con.query(
            "DELETE FROM Notificaciones WHERE id_Notificacion = ?",
            [id]
        );

        return res.status(200).json({ ok: true, message: "Notificación eliminada exitosamente" });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
};

const obtenerNotificacionesPorUsuario = async (req, res) => {
    const { id_cuenta } = req.params;
    const con = await db.getConnection();

    try {
        let { page = 1, limit = 10, entregado } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 10;

        const offset = (page - 1) * limit;

        let whereClause = "WHERE N.cuenta_Receptor = ?";
        let queryParams = [id_cuenta];

        if (entregado !== undefined) {
            whereClause += " AND N.entregado = ?";
            queryParams.push(entregado === 'true' || entregado === '1' ? 1 : 0);
        }

        const [countResult] = await con.query(
            `SELECT COUNT(*) AS total FROM Notificaciones N ${whereClause}`,
            queryParams
        );
        const total = countResult[0].total;

        const [notificaciones] = await con.query(
            `SELECT 
                N.id_Notificacion,
                N.cuenta_Emisora,
                N.titulo,
                N.contenido,
                N.entregado,
                N.fecha_Creacion,
                CE.nombre AS nombre_Emisor
            FROM Notificaciones N
            LEFT JOIN Cuentas CE ON N.cuenta_Emisora = CE.id_Cuenta
            ${whereClause}
            ORDER BY N.fecha_Creacion DESC
            LIMIT ? OFFSET ?`,
            [...queryParams, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            ok: true,
            total,
            page,
            totalPages,
            limit,
            data: notificaciones,
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: "Algo salió mal" });
    } finally {
        con.release();
    }
};

module.exports = {
    crearNotificacion,
    obtenerNotificaciones,
    obtenerNotificacionOne,
    marcarComoEntregada,
    marcarVariasComoEntregadas,
    eliminarNotificacion,
    obtenerNotificacionesPorUsuario,
};
