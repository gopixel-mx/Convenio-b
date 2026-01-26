const path = require("path");
const fs = require("fs");
const db = require("../config/mysql");
require('dotenv').config();

// 1. Mapas y configuración centralizada
const formFieldMap = {
  "Acta Constitutiva": "Acta",
  "Poder del Representante Legal": "Poder",
  "Alta ante Hacienda": "AltaHacienda",
  "Identificación Oficial": "Identificacion",
  "Comprobante de Domicilio": "Comprobante",
  "Poder del Representante Legal / Nombramiento / Decreto": "Nombramiento",
  "Convenio Firmado": "ConvenioFirmado"
};

const reverseFormFieldMap = Object.fromEntries(Object.entries(formFieldMap).map(([k, v]) => [v, k]));

const cleanupFiles = (files) => {
    if (files) Object.values(files).flat().forEach(file => {
        try { fs.unlinkSync(file.path); } catch (e) { console.error("Error limpiando archivo:", e); }
    });
};

const withDb = async (req, res, callback) => {
    if (req.headers['api_key'] !== process.env.X_API_KEY) {
        return res.status(401).json({ ok: false, msg: 'Falta api key' });
    }
    const con = await db.getConnection();
    try {
        await callback(con);
    } catch (err) {
        console.error("SERVER ERROR:", err);
        if (!res.headersSent) res.status(500).json({ ok: false, msg: 'Error en el servidor' });
    } finally {
        con.release();
    }
};

const tiposDocumentos = (req, res) => withDb(req, res, async (con) => {
    const [tipos] = await con.query("SELECT * FROM Tipos_Documentos");
    res.status(200).json({ tipos });
});

const subirDocumentos = (req, res) => withDb(req, res, async (con) => {
    const { folio, idConvenio, tipoPersona } = req.body;
    const files = req.files;

    if (!folio || !idConvenio || !tipoPersona) {
        cleanupFiles(files);
        return res.status(400).json({ message: "Todos los datos (folio, idConvenio, tipoPersona) son requeridos" });
    }

    const [rows] = await con.query("SELECT id_Tipo_Documento, nombre FROM Tipos_Documentos WHERE owner = ?", [tipoPersona]);

    if (!rows.length) {
        cleanupFiles(files);
        return res.status(400).json({ message: `No existen documentos configurados para: ${tipoPersona}` });
    }

    if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({ message: "No se recibieron archivos" });
    }

    const tipoDocMap = rows.reduce((acc, row) => {
        const campo = formFieldMap[row.nombre];
        if (campo) acc[campo] = row.id_Tipo_Documento;
        return acc;
    }, {});

    const uploadsPath = process.env.UPLOADS_DIR || "uploads";
    const baseDir = path.isAbsolute(uploadsPath) ? uploadsPath : path.join(process.cwd(), uploadsPath);
    const carpetaFolio = path.join(baseDir, folio.toString());
    if (!fs.existsSync(carpetaFolio)) fs.mkdirSync(carpetaFolio, { recursive: true });

    const inserts = [];
    const updates = [];

    for (const key in files) {
        const file = files[key][0];
        const idTipo = tipoDocMap[key];
        
        if (!idTipo) {
            fs.unlinkSync(file.path);
            continue;
        }

        try {
            const newFileName = `${file.fieldname}${path.extname(file.originalname)}`;
            const newPath = path.join(carpetaFolio, newFileName);
            
            // Verificar si ya existe un documento de este tipo para este convenio
            const [existing] = await con.query(
                "SELECT id_Anexo, ruta_archivo FROM Convenios_Anexos WHERE id_Convenio = ? AND id_Tipo_Documento = ?",
                [idConvenio, idTipo]
            );
            
            // Si existe, eliminar el archivo anterior físicamente
            if (existing.length > 0) {
                const oldFile = existing[0].ruta_archivo;
                if (fs.existsSync(oldFile)) {
                    fs.unlinkSync(oldFile);
                }
                // Eliminar el registro de la base de datos
                await con.query("DELETE FROM Convenios_Anexos WHERE id_Anexo = ?", [existing[0].id_Anexo]);
            }
            
            // Mover el nuevo archivo
            fs.renameSync(file.path, newPath);
            
            inserts.push([idConvenio, idTipo, path.join(baseDir, folio.toString(), newFileName)]);
        } catch (err) {
            console.error(`Error moviendo archivo ${file.path}:`, err);
        }
    }

    if (!inserts.length) return res.status(400).json({ message: "Ningún archivo válido fue procesado." });

    await con.query("INSERT INTO Convenios_Anexos (id_Convenio, id_Tipo_Documento, ruta_archivo) VALUES ?", [inserts]);
    
    res.json({ message: "Documentos guardados exitosamente", documentosProcesados: inserts.length });
});

const obtenerAnexos = (req, res) => withDb(req, res, async (con) => {
    const [rows] = await con.query(
        `SELECT cd.id_Anexo, cd.ruta_archivo, td.nombre AS tipo_documento
         FROM Convenios_Anexos cd
         JOIN Tipos_Documentos td ON cd.id_Tipo_Documento = td.id_Tipo_Documento
         WHERE cd.id_Convenio = ?`, [req.params.idConvenio]
    );
    res.status(201).json({ Anexos: rows });
});

const descargarAnexo = (req, res) => withDb(req, res, async (con) => {
    const nombreDocumento = reverseFormFieldMap[req.params.docKey];
    if (!nombreDocumento) return res.status(404).json({ message: "Clave de documento inválida" });

    const [rows] = await con.query(
        `SELECT cd.ruta_archivo FROM Convenios_Anexos cd
         JOIN Tipos_Documentos td ON cd.id_Tipo_Documento = td.id_Tipo_Documento
         WHERE cd.id_Convenio = ? AND td.nombre = ?`, [req.params.idConvenio, nombreDocumento]
    );

    if (!rows.length) return res.status(404).json({ message: "Anexo no encontrado" });

    const rutaAbsoluta = path.resolve(rows[0].ruta_archivo);

    if (!fs.existsSync(rutaAbsoluta)) return res.status(404).json({ message: "El archivo físico no existe" });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(rutaAbsoluta)}"`);
    res.sendFile(rutaAbsoluta);
});

const deleteAnexo = (req, res) => withDb(req, res, async (con) => {
    const [rows] = await con.query("SELECT ruta_archivo FROM Convenios_Anexos WHERE id_Anexo = ?", [req.params.idAnexo]);
    
    if (!rows.length) return res.status(404).json({ message: "Anexo no encontrado" });

    await con.query("DELETE FROM Convenios_Anexos WHERE id_Anexo = ?", [req.params.idAnexo]);
    
    fs.unlink(rows[0].ruta_archivo, (err) => {
        if (err) console.error("Error eliminando físico:", err);
    });

    res.status(200).json({ message: "Anexo eliminado exitosamente" });
});

module.exports = { subirDocumentos, tiposDocumentos, obtenerAnexos, deleteAnexo, descargarAnexo };