const db = require("../config/mysql");
const fs = require("fs");
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');

const draft = async (req, res) => {
    const con = await db.getConnection();
    const {id_Creador_Cuenta, id_Unidad_Academica, tipo_Convenio, fecha_Inicio, fecha_Fin, id_Organizacion} = req.body;

    try {
        //validacion de unidad academica
        const [existingUnidad] = await con.query(
            "SELECT * FROM Unidades_Academicas WHERE id_Unidad_Academica = ?",
            [id_Unidad_Academica]
        );

        if (existingUnidad.length < 1) {
            return res.status(409).json({ ok: false, msg: "La unidad no existe" });
        }

        //validacion de cuenta
        const [existingCuenta] = await con.query(
            "SELECT * FROM Cuentas WHERE id_Cuenta = ?",
            [id_Creador_Cuenta]
        );

        if (existingCuenta.length < 1) {
            return res.status(409).json({ ok: false, msg: "La cuenta de creador no existe" });
        }

        // Validacion de organizacion si se proporciona
        if (id_Organizacion) {
            const [existingOrganizacion] = await con.query(
                "SELECT * FROM Organizaciones WHERE id_Organizacion = ?",
                [id_Organizacion]
            );

            if (existingOrganizacion.length < 1) {
                return res.status(409).json({ ok: false, msg: "La organización no existe" });
            }
        }

        // Generar el número de folio automáticamente
        const [folioResult] = await con.query(
            "SELECT id_Folio, clave FROM Folios WHERE id_Unidad_Academica = ?",
            [id_Unidad_Academica]
        );

        let numero_convenio;
        const year = new Date().getFullYear();
        
        if (folioResult.length > 0) {
            // Si existe folio para esta unidad, incrementar
            const folioActual = folioResult[0];
            const nuevoConsecutivo = parseInt(folioActual.clave) + 1;
            const claveFormateada = String(nuevoConsecutivo).padStart(6, '0');
            
            // Actualizar el folio en la tabla
            await con.query(
                "UPDATE Folios SET clave = ? WHERE id_Unidad_Academica = ?",
                [claveFormateada, id_Unidad_Academica]
            );
            
            numero_convenio = `CONV-${year}-${claveFormateada}`;
        } else {
            // Si no existe, crear el primer folio para esta unidad
            const claveInicial = '000001';
            await con.query(
                "INSERT INTO Folios (id_Unidad_Academica, clave) VALUES (?, ?)",
                [id_Unidad_Academica, claveInicial]
            );
            
            numero_convenio = `CONV-${year}-${claveInicial}`;
        }

        const [result] = await con.query(
            "INSERT INTO Convenios(numero_Convenio, id_Unidad_Academica, id_Creador_Cuenta, id_Organizacion, tipo_Convenio, estado, fecha_Inicio, fecha_Fin, ultimo_paso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [numero_convenio, id_Unidad_Academica, id_Creador_Cuenta, id_Organizacion, tipo_Convenio, "Incompleto", fecha_Inicio, fecha_Fin, 2]
        );

        return res.status(201).json({ 
            ok: true, 
            msg: "Convenio creado exitosamente",
            id_Convenio: result.insertId,
            numero_convenio: numero_convenio
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const ActualizarDraft = async (req, res) => {
    const con = await db.getConnection();
    const {numero_convenio, id_Organizacion, estado, contenido_Personalizado, ultimo_paso} = req.body;

    try {
        //validacion de folio
        const [existingConvenio] = await con.query(
            "SELECT * FROM Convenios WHERE numero_Convenio = ?",
            [numero_convenio]
        );

        if (existingConvenio.length < 1) {
            return res.status(409).json({ ok: false, msg: "El convenio no existe" });
        }

        if(ultimo_paso === undefined){
            return res.status(409).json({ ok: false, msg: "se requiere último paso" });
        }

        if(id_Organizacion !== undefined){
            const [existingOrganizacion] = await con.query(
                "SELECT * FROM Organizaciones WHERE id_Organizacion = ?",
                [id_Organizacion]
            );
            
            if(existingOrganizacion.length < 1) return res.status(409).json({ ok: false, msg: "La organizacion no existe" });

            await con.query(
                "UPDATE Convenios SET id_Organizacion = ? WHERE numero_convenio = ?",
                [id_Organizacion, numero_convenio]
            );
        }

        if(estado !== undefined){
            await con.query(
                "UPDATE Convenios SET estado = ? WHERE numero_convenio = ?",
                [estado, numero_convenio]
            );
        }

        if(contenido_Personalizado !== undefined){
            await con.query(
                "UPDATE Convenios SET contenido_Personalizado = ? WHERE numero_convenio = ?",
                [contenido_Personalizado, numero_convenio]
            );
        }

        await con.query(
            "UPDATE Convenios SET ultimo_paso = ? WHERE numero_convenio = ?",
            [ultimo_paso, numero_convenio]
        );

        return res.status(201).json({ ok: true, msg: 'convenio actualizado exitosamente' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const obtenerConvenio = async (req, res) => {
    const {numeroConvenio} = req.params;
    const con = await db.getConnection();
    try {
        //validacion de folio
        const [existingConvenio] = await con.query(
            `SELECT C.*, O.*, 
             C.id_Convenio as convenio_id,
             C.estado as convenio_estado,
             O.tipo as tipo_organizacion
             FROM Convenios C 
             LEFT JOIN Organizaciones O ON C.id_Organizacion = O.id_Organizacion
             WHERE C.numero_Convenio = ?`,
            [numeroConvenio]
        );

        if (existingConvenio.length < 1) {
            return res.status(409).json({ ok: false, msg: "El convenio no existe" });
        }

        // Obtener testigos si existen
        const [testigos] = await con.query(
            "SELECT nombre FROM Testigos WHERE id_Organizacion = ?",
            [existingConvenio[0].id_Organizacion]
        );

        return res.status(201).json({ 
            ok: true, 
            convenio: existingConvenio[0],
            testigos: testigos.map(t => t.nombre)
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const obtenerConvenios = async (req, res) => {
    const { rol, id_Cuenta, rfc, id_Unidad_Academica } = req.user; 
    
    const con = await db.getConnection();
    
    try {
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1) limit = 10;

        const offset = (page - 1) * limit;

        let countQueryBase = "SELECT COUNT(*) AS total FROM Convenios C INNER JOIN Unidades_Academicas UA ON UA.id_Unidad_Academica = C.id_Unidad_Academica INNER JOIN Organizaciones O ON O.id_Organizacion = C.id_Organizacion";
        let dataQueryBase = `
            SELECT 
                C.*,
                DATE_FORMAT(C.fecha_Inicio, '%Y-%m-%d') AS fecha_Inicio,
                UA.nombre AS unidad,
                O.nombre_Legal AS nombre_Organizacion,
                COUNT(CA.id_Anexo) AS documentos_count
            FROM Convenios C
            INNER JOIN Unidades_Academicas UA ON UA.id_Unidad_Academica = C.id_Unidad_Academica
            INNER JOIN Organizaciones O ON O.id_Organizacion = C.id_Organizacion
            LEFT JOIN Convenios_Anexos CA ON CA.id_Convenio = C.id_Convenio
        `;
        let queryParams = [];
        let whereClause = "";

        switch (rol) {
            case 'Gestor':
                whereClause = " WHERE C.id_Creador_Cuenta = ?";
                queryParams.push(id_Cuenta);
                break;

            case 'Organización':
                whereClause = " WHERE C.id_Creador_Cuenta = ? OR O.rfc = ?";
                queryParams.push(id_Cuenta, rfc);
                break;
            
            case 'Revisor':
                whereClause = " WHERE C.id_Creador_Cuenta = ? OR C.id_Unidad_Academica = ?";
                queryParams.push(id_Cuenta, id_Unidad_Academica);
                break;

            case 'Director Unidad':
                whereClause = " WHERE C.id_Unidad_Academica = ?";
                queryParams.push(id_Unidad_Academica);
                break;
            
            case 'Coordinador':
            case 'Director General':
                break;
                
            default:
                return res.status(403).json({ message: 'Acceso denegado. Rol no autorizado para esta acción.' });
        }
        const [countResult] = await con.query(countQueryBase + whereClause, queryParams);
        const total = countResult[0].total;

        let dataQuery = dataQueryBase + whereClause + `
            GROUP BY
                C.id_Convenio,
                C.fecha_Inicio,
                C.fecha_Fin,
                UA.nombre,
                O.nombre_Legal
            ORDER BY C.id_Convenio DESC LIMIT ? OFFSET ?
        `;
        
        let dataQueryParams = [...queryParams, limit, offset];

        const [convenios] = await con.query(dataQuery, dataQueryParams);

        // Obtener los documentos de cada convenio
        for (let convenio of convenios) {
            const [documentos] = await con.query(
                `SELECT TD.nombre 
                 FROM Convenios_Anexos CA 
                 INNER JOIN Tipos_Documentos TD ON CA.id_Tipo_Documento = TD.id_Tipo_Documento 
                 WHERE CA.id_Convenio = ?`,
                [convenio.id_Convenio]
            );
            convenio.documentos = documentos.map(doc => doc.nombre);
        }

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            total,
            page,
            totalPages,
            limit,
            data: convenios,
        });

    } catch (err) {
        console.error("Error en obtenerConvenios:", err);
        return res.status(500).json({ ok: false, msg: "Algo salió mal al obtener los convenios" });
    } finally {
        con.release();
    }
};

const convenioEmpresas = async (req, res) => {
    const con = await db.getConnection();
    const { numero_convenio } = req.body;

    try {
        // Consultar datos del convenio con toda la información necesaria
        const [convenioData] = await con.query(
            `SELECT 
                C.*,
                O.*,
                UA.nombre AS nombre_unidad,
                UA.representante AS nombre,
                UA.domicilio AS domicilio_unidad,
                C.id_Convenio as convenio_id,
                C.estado as convenio_estado,
                O.tipo as tipo_organizacion,
                O.nombre_Legal AS nombre_empresa,
                O.nombre_Titular AS nombre_jefe,
                O.puesto_Titular AS puesto,
                O.nombre_Comercial AS nombre_comercial,
                O.numero_Escritura,
                O.fecha_Nombramiento AS fecha_nombramiento,
                O.nombre_Notario AS nombre_notario,
                O.numero_Notaria AS numero_notaria,
                O.actividades,
                CONCAT(O.domicilio_Calle, ', ', O.domicilio_CP) AS domicilio,
                O.contacto_Telefono AS telefono,
                O.contacto_Email AS mail,
                (SELECT nombre FROM Municipios WHERE id_municipio = O.notaria_Municipio) AS municipio_notaria
            FROM Convenios C
            LEFT JOIN Organizaciones O ON C.id_Organizacion = O.id_Organizacion
            LEFT JOIN Unidades_Academicas UA ON C.id_Unidad_Academica = UA.id_Unidad_Academica
            WHERE C.numero_Convenio = ?`,
            [numero_convenio]
        );

        if (convenioData.length < 1) {
            return res.status(404).json({ ok: false, msg: "Convenio no encontrado" });
        }

        const data = convenioData[0];

        // Formatear fecha si existe
        if (data.fecha_nombramiento) {
            const fecha = new Date(data.fecha_nombramiento);
            const dia = fecha.getDate();
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const mes = meses[fecha.getMonth()];
            const anio = fecha.getFullYear();
            data.fecha_nombramiento = `${dia} del mes de ${mes} del año ${anio}`;
        }

        // Cargar y compilar la plantilla
        const source = fs.readFileSync('./formatos/empresa.html').toString();
        const sinSaltosDeLinea = source.replace(/\n/g, '');
        
        const template = handlebars.compile(sinSaltosDeLinea);
        const htmlToSend = template(data);

        res.status(200).json({ok: true, html: htmlToSend});
    } catch (err) {
        console.error(err);
        return res.status(500).json({ ok: false, msg: 'Error al generar el convenio' });
    } finally {
        con.release();
    }
}

const convenioDependencia = async (req, res) => {
    const source = fs.readFileSync('./formatos/dependencia.html').toString();

    const sinSaltosDeLinea = source.replace(/\n/g, '');
    const template = handlebars.compile(sinSaltosDeLinea);
    const htmlToSend = template(req.body);
    
    res.status(200).json({ok: true, html: htmlToSend});
}

const convenioPersona = async (req, res) => {
    const source = fs.readFileSync('./formatos/persona.html').toString();
    
    const sinSaltosDeLinea = source.replace(/\n/g, '');
    const template = handlebars.compile(sinSaltosDeLinea);
    const htmlToSend = template(req.body);

    res.status(200).json({ok: true, html: htmlToSend});
}

const generarPdf = async (req, res) => {
    try {
        const { htmlContent } = req.body;

        // 1. Leer las imágenes del header y footer y convertirlas a base64
        const headerImagePath = './header.jpg';
        const footerImagePath = './footer.jpg';
        const headerImageBuffer = fs.readFileSync(headerImagePath);
        const footerImageBuffer = fs.readFileSync(footerImagePath);
        const headerBase64 = headerImageBuffer.toString('base64');
        const footerBase64 = footerImageBuffer.toString('base64');

        // 2. Lanzar el navegador
        const browser = await puppeteer.launch({ 
            headless: "new", 
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ] 
        });
        const page = await browser.newPage();

        // 3. Envolver el contenido HTML con estilos y fuentes
        const htmlWithStyles = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Mada:wght@200;300;400;500;600;700;900&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'Mada', Arial, sans-serif;
                        font-size: 10pt;
                        line-height: 1.4;
                        text-align: justify;
                        margin: 0;
                        padding: 0;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;

        // 4. Definir el contenido HTML
        await page.setContent(htmlWithStyles, { waitUntil: 'networkidle0' });

        // 5. Generar el PDF en memoria (Buffer)
        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `
                <div style="width: 100%; margin: 0; padding: 0;">
                    <img src="data:image/jpeg;base64,${headerBase64}" 
                         style="width: 21.59cm; height: 95%; display: block; margin: 0;" />
                </div>
            `,
            footerTemplate: `
                <div style="width: 100%; margin: 0; padding: 0;">
                    <img src="data:image/jpeg;base64,${footerBase64}" 
                         style="width: 21.59cm; height: auto; display: block; margin: 0;" />
                </div>
            `,
            margin: { 
                top: '4.5cm', 
                right: '2.5cm', 
                bottom: '4cm', 
                left: '2.5cm' 
            }
        });

        await browser.close();

        // 6. Configurar headers y enviar el PDF
        res.contentType("application/pdf");
        res.send(pdfBuffer);

    } catch (error) {
        console.error(error);
        res.status(500).send('Error generando el PDF');
    }
}

const enviarARevision = async (req, res) => {
    const con = await db.getConnection();
    const { id_Convenio, observaciones, id_Usuario } = req.body;

    try {
        // Validar que el convenio existe y obtener sus datos
        const [convenio] = await con.query(
            `SELECT c.*, c.numero_Convenio, c.id_Unidad_Academica 
             FROM Convenios c 
             WHERE c.id_Convenio = ?`,
            [id_Convenio]
        );

        if (convenio.length < 1) {
            return res.status(404).json({ ok: false, msg: "El convenio no existe" });
        }

        const convenioData = convenio[0];
        const numero_Convenio = convenioData.numero_Convenio;
        const id_Unidad_Academica = convenioData.id_Unidad_Academica;

        // Obtener el revisor de la misma Unidad Académica
        const [revisor] = await con.query(
            "SELECT id_Cuenta FROM Cuentas WHERE id_Unidad_Academica = ? AND rol = 'Revisor' AND estado = 'Activo' LIMIT 1",
            [id_Unidad_Academica]
        );

        // Actualizar el estado del convenio a "En Revisión" y cambiar ultimo_paso a 1
        await con.query(
            "UPDATE Convenios SET estado = 'En Revisión', ultimo_paso = 1 WHERE id_Convenio = ?",
            [id_Convenio]
        );

        // Guardar las observaciones si se proporcionaron
        if (observaciones && observaciones.trim() !== '') {
            const fecha_Creacion = new Date().toISOString().split('T')[0];
            await con.query(
                "INSERT INTO Observaciones (id_Convenio, id_Usuario, observacion, fecha_Creacion) VALUES (?, ?, ?, ?)",
                [id_Convenio, id_Usuario, observaciones, fecha_Creacion]
            );
        }

        // Crear notificación al revisor si existe uno en la unidad académica
        if (revisor.length > 0) {
            const titulo = `Revisión del convenio ${numero_Convenio}`;
            // Si hay observaciones, usarlas como contenido; si no, usar mensaje simple
            const contenido = (observaciones && observaciones.trim() !== '') 
                ? observaciones.trim()
                : `Convenio ${numero_Convenio} enviado a revisión`;
            const fecha_Creacion = new Date().toISOString().slice(0, 19).replace('T', ' ');

            await con.query(
                `INSERT INTO Notificaciones 
                (cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo, entregado, fecha_Creacion) 
                VALUES (?, ?, ?, ?, 'validacion', 0, ?)`,
                [revisor[0].id_Cuenta, id_Usuario, titulo, contenido, fecha_Creacion]
            );
        }

        return res.status(200).json({ 
            ok: true, 
            msg: "Convenio enviado a revisión exitosamente"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Error al enviar el convenio a revisión' });
    } finally {
        con.release();
    }
}

const validarConvenio = async (req, res) => {
    const con = await db.getConnection();
    const { id_Convenio, observaciones, id_Usuario } = req.body;

    try {
        // Validar que el convenio existe y está en estado "En Revisión"
        const [convenio] = await con.query(
            `SELECT c.*, c.numero_Convenio 
             FROM Convenios c 
             WHERE c.id_Convenio = ?`,
            [id_Convenio]
        );

        if (convenio.length < 1) {
            return res.status(404).json({ ok: false, msg: "El convenio no existe" });
        }

        if (convenio[0].estado !== "En Revisión") {
            return res.status(400).json({ ok: false, msg: "El convenio no está en estado 'En Revisión'" });
        }

        const numero_Convenio = convenio[0].numero_Convenio;

        // Actualizar el estado del convenio a "En Validación" y cambiar ultimo_paso a 1
        await con.query(
            "UPDATE Convenios SET estado = 'En Validación', ultimo_paso = 1 WHERE id_Convenio = ?",
            [id_Convenio]
        );

        // Guardar las observaciones si se proporcionaron
        if (observaciones && observaciones.trim() !== '') {
            const fecha_Creacion = new Date().toISOString().split('T')[0];
            await con.query(
                "INSERT INTO Observaciones (id_Convenio, id_Usuario, observacion, fecha_Creacion) VALUES (?, ?, ?, ?)",
                [id_Convenio, id_Usuario, observaciones, fecha_Creacion]
            );
        }

        // Obtener todos los coordinadores activos
        const [coordinadores] = await con.query(
            "SELECT id_Cuenta FROM Cuentas WHERE rol = 'Coordinador' AND estado = 'Activo'"
        );

        // Crear notificación para cada coordinador
        if (coordinadores.length > 0) {
            const titulo = `Validación del convenio ${numero_Convenio}`;
            // Si hay observaciones, usarlas como contenido; si no, usar mensaje simple
            const contenido = (observaciones && observaciones.trim() !== '') 
                ? observaciones.trim()
                : `Convenio ${numero_Convenio} enviado a validación`;
            const fecha_Creacion = new Date().toISOString().slice(0, 19).replace('T', ' ');

            for (const coordinador of coordinadores) {
                await con.query(
                    `INSERT INTO Notificaciones 
                    (cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo, entregado, fecha_Creacion) 
                    VALUES (?, ?, ?, ?, 'validacion', 0, ?)`,
                    [coordinador.id_Cuenta, id_Usuario, titulo, contenido, fecha_Creacion]
                );
            }
        }

        return res.status(200).json({ 
            ok: true, 
            msg: "Convenio validado exitosamente"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Error al validar el convenio' });
    } finally {
        con.release();
    }
}

const validarCoordinador = async (req, res) => {
    const con = await db.getConnection();
    const { id_Convenio, observaciones, id_Usuario } = req.body;

    try {
        // Validar que el convenio existe y está en estado "En Validación"
        const [convenio] = await con.query(
            `SELECT c.*, c.numero_Convenio 
             FROM Convenios c 
             WHERE c.id_Convenio = ?`,
            [id_Convenio]
        );

        if (convenio.length < 1) {
            return res.status(404).json({ ok: false, msg: "El convenio no existe" });
        }

        if (convenio[0].estado !== "En Validación") {
            return res.status(400).json({ ok: false, msg: "El convenio no está en estado 'En Validación'" });
        }

        const numero_Convenio = convenio[0].numero_Convenio;

        // Actualizar el estado del convenio a "Validado"
        await con.query(
            "UPDATE Convenios SET estado = 'Validado' WHERE id_Convenio = ?",
            [id_Convenio]
        );

        // Guardar las observaciones si se proporcionaron
        if (observaciones && observaciones.trim() !== '') {
            const fecha_Creacion = new Date().toISOString().split('T')[0];
            await con.query(
                "INSERT INTO Observaciones (id_Convenio, id_Usuario, observacion, fecha_Creacion) VALUES (?, ?, ?, ?)",
                [id_Convenio, id_Usuario, observaciones, fecha_Creacion]
            );
        }

        // Obtener el Director General activo
        const [directorGeneral] = await con.query(
            "SELECT id_Cuenta FROM Cuentas WHERE rol = 'Director General' AND estado = 'Activo' LIMIT 1"
        );

        // Crear notificación al Director General si existe
        if (directorGeneral.length > 0) {
            const titulo = `Convenio validado ${numero_Convenio}`;
            // Si hay observaciones, usarlas como contenido; si no, usar mensaje simple
            const contenido = (observaciones && observaciones.trim() !== '') 
                ? observaciones.trim()
                : `Convenio ${numero_Convenio} validado`;
            const fecha_Notif = new Date().toISOString().slice(0, 19).replace('T', ' ');

            await con.query(
                `INSERT INTO Notificaciones 
                (cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo, entregado, fecha_Creacion) 
                VALUES (?, ?, ?, ?, 'validacion', 0, ?)`,
                [directorGeneral[0].id_Cuenta, id_Usuario, titulo, contenido, fecha_Notif]
            );
        }

        return res.status(200).json({ 
            ok: true, 
            msg: "Convenio validado exitosamente"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Error al validar el convenio' });
    } finally {
        con.release();
    }
}

const requiereAjuste = async (req, res) => {
    const con = await db.getConnection();
    const { id_Convenio, observaciones, id_Usuario } = req.body;

    try {
        // Validar que el convenio existe y está en estado "En Validación"
        const [convenio] = await con.query(
            `SELECT c.*, c.numero_Convenio, c.id_Unidad_Academica 
             FROM Convenios c 
             WHERE c.id_Convenio = ?`,
            [id_Convenio]
        );

        if (convenio.length < 1) {
            return res.status(404).json({ ok: false, msg: "El convenio no existe" });
        }

        if (convenio[0].estado !== "En Validación") {
            return res.status(400).json({ ok: false, msg: "El convenio no está en estado 'En Validación'" });
        }

        const numero_Convenio = convenio[0].numero_Convenio;
        const id_Unidad_Academica = convenio[0].id_Unidad_Academica;

        // Obtener los datos del coordinador
        const [coordinador] = await con.query(
            "SELECT nombre, correo FROM Cuentas WHERE id_Cuenta = ?",
            [id_Usuario]
        );

        if (coordinador.length < 1) {
            return res.status(404).json({ ok: false, msg: "El usuario no existe" });
        }

        const coordinadorData = coordinador[0];

        // Actualizar el estado del convenio a "Requiere Ajuste" y cambiar ultimo_paso a 1
        await con.query(
            "UPDATE Convenios SET estado = 'Requiere Ajuste', ultimo_paso = 1 WHERE id_Convenio = ?",
            [id_Convenio]
        );

        // Guardar las observaciones (obligatorias en este caso)
        const fecha_Creacion = new Date().toISOString().split('T')[0];
        await con.query(
            "INSERT INTO Observaciones (id_Convenio, id_Usuario, observacion, fecha_Creacion) VALUES (?, ?, ?, ?)",
            [id_Convenio, id_Usuario, observaciones, fecha_Creacion]
        );

        // Obtener el revisor de la misma Unidad Académica
        const [revisor] = await con.query(
            "SELECT id_Cuenta FROM Cuentas WHERE id_Unidad_Academica = ? AND rol = 'Revisor' AND estado = 'Activo' LIMIT 1",
            [id_Unidad_Academica]
        );

        // Crear notificación al revisor si existe uno en la unidad académica
        if (revisor.length > 0) {
            const titulo = `Ajustes requeridos en convenio ${numero_Convenio}`;
            // Las observaciones son obligatorias en requiere ajuste, así que siempre las usamos
            const contenido = observaciones.trim();
            const fecha_Notif = new Date().toISOString().slice(0, 19).replace('T', ' ');

            await con.query(
                `INSERT INTO Notificaciones 
                (cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo, entregado, fecha_Creacion) 
                VALUES (?, ?, ?, ?, 'validacion', 0, ?)`,
                [revisor[0].id_Cuenta, id_Usuario, titulo, contenido, fecha_Notif]
            );

            const io = req.app.get('socketio');
            if (io) {
                io.to(`cuenta_${revisor[0].id_Cuenta}`).emit('nueva_notificacion', {
                    id_Notificacion: null,
                    cuenta_Receptor: revisor[0].id_Cuenta,
                    cuenta_Emisora: id_Usuario,
                    titulo: titulo,
                    contenido: contenido,
                    tipo: 'validacion',
                    entregado: 0,
                    fecha_Creacion: fecha_Notif
                });
            }
        }

        return res.status(200).json({ 
            ok: true, 
            msg: "Convenio marcado como 'Requiere Ajuste'"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Error al marcar el convenio' });
    } finally {
        con.release();
    }
}

const solicitarCorreccion = async (req, res) => {
    const { id_Convenio, observaciones, id_Usuario } = req.body;
    const con = await db.getConnection();

    try {
        if (!id_Convenio || !observaciones || !id_Usuario) {
            return res.status(400).json({ ok: false, msg: "Faltan datos requeridos" });
        }

        // Obtener información del convenio y el gestor que lo creó
        const [convenio] = await con.query(
            `SELECT c.*, c.numero_Convenio, c.id_Creador_Cuenta 
             FROM Convenios c 
             WHERE c.id_Convenio = ?`,
            [id_Convenio]
        );

        if (convenio.length < 1) {
            return res.status(404).json({ ok: false, msg: "El convenio no existe" });
        }

        if (convenio[0].estado !== "En Revisión" && convenio[0].estado !== "Requiere Ajuste") {
            return res.status(400).json({ ok: false, msg: "El convenio no está en estado 'En Revisión' o 'Requiere Ajuste'" });
        }

        const numero_Convenio = convenio[0].numero_Convenio;
        const id_Gestor = convenio[0].id_Creador_Cuenta;

        console.log("Actualizando convenio a 'En Corrección':", id_Convenio);

        // Actualizar el estado del convenio a "En Corrección" y cambiar ultimo_paso a 1
        const [updateResult] = await con.query(
            "UPDATE Convenios SET estado = 'En Corrección', ultimo_paso = 1 WHERE id_Convenio = ?",
            [id_Convenio]
        );

        console.log("Resultado del UPDATE:", updateResult);

        // Guardar las observaciones
        const fecha_Creacion = new Date().toISOString().split('T')[0];
        await con.query(
            "INSERT INTO Observaciones (id_Convenio, id_Usuario, observacion, fecha_Creacion) VALUES (?, ?, ?, ?)",
            [id_Convenio, id_Usuario, observaciones, fecha_Creacion]
        );

        // Crear notificación al gestor que creó el convenio
        const titulo = `Correcciones requeridas en convenio ${numero_Convenio}`;
        const contenido = observaciones.trim();
        const fecha_Notif = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await con.query(
            `INSERT INTO Notificaciones 
            (cuenta_Receptor, cuenta_Emisora, titulo, contenido, tipo, entregado, fecha_Creacion) 
            VALUES (?, ?, ?, ?, 'correccion', 0, ?)`,
            [id_Gestor, id_Usuario, titulo, contenido, fecha_Notif]
        );

        const io = req.app.get('socketio');
        if (io) {
            io.to(`cuenta_${id_Gestor}`).emit('nueva_notificacion', {
                id_Notificacion: null,
                cuenta_Receptor: id_Gestor,
                cuenta_Emisora: id_Usuario,
                titulo: titulo,
                contenido: contenido,
                tipo: 'correccion',
                entregado: 0,
                fecha_Creacion: fecha_Notif
            });
        }

        return res.status(200).json({ 
            ok: true, 
            msg: "Solicitud de corrección enviada exitosamente"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, msg: 'Error al solicitar corrección' });
    } finally {
        con.release();
    }
}

module.exports = {
    draft,
    ActualizarDraft,
    obtenerConvenio,
    obtenerConvenios,
    convenioEmpresas,
    convenioDependencia,
    convenioPersona,
    generarPdf,
    enviarARevision,
    validarConvenio,
    validarCoordinador,
    requiereAjuste,
    solicitarCorreccion
}