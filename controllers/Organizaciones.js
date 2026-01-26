const db = require("../config/mysql");
const mammoth = require('mammoth');

const registrarOrganizacion = async (req, res) => {
    const con = await db.getConnection();
    const {
        rfc,
        nombre_Legal,
        nombre_Comercial,
        nombre_Titular,
        puesto_Titular,
        numero_Escritura,
        fecha_Creacion,
        nombre_Notario,
        numero_Notaria,
        notaria_Estado,
        notaria_Municipio,
        actividades,
        domicilio_Calle,
        domicilio_Estado,
        domicilio_Municipio,
        domicilio_CP,
        contacto_Telefono,
        contacto_Email,
        oficio_Nombramiento,
        fecha_Nombramiento,
        ine_Representante,
        acta_constitutiva,
        tipo,
        testigos
    } = req.body
    try {
        console.log('Request body recibido:', req.body);
        
        //validar RFC
        const [validacion] = await con.query(
            "SELECT COUNT(*) AS res FROM Organizaciones WHERE rfc = ?",
            [rfc]
        );
        if(validacion[0].res > 0){
            return res.status(400).json({ok: false, msg: "RFC registrado previamente"});
        }

        const [formulario] = await con.query(
            `INSERT INTO Organizaciones(rfc, nombre_Legal, nombre_Comercial, nombre_Titular, puesto_Titular, numero_Escritura, fecha_Creacion, nombre_Notario,
            numero_Notaria, notaria_Estado, notaria_Municipio, actividades, domicilio_Calle, domicilio_Estado, domicilio_Municipio, domicilio_CP, contacto_Telefono, 
            contacto_Email, oficio_Nombramiento, fecha_Nombramiento, ine_Representante, acta_constitutiva, tipo)
            VALUES(?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rfc, nombre_Legal, nombre_Comercial, nombre_Titular, puesto_Titular, numero_Escritura, nombre_Notario, numero_Notaria, notaria_Estado, notaria_Municipio,
            actividades, domicilio_Calle, domicilio_Estado, domicilio_Municipio, domicilio_CP, contacto_Telefono, contacto_Email, oficio_Nombramiento, fecha_Nombramiento,
            ine_Representante, acta_constitutiva, tipo]
        );

        console.log(formulario);

        for(const testigo of testigos){
            await con.query(
                "INSERT INTO Testigos(id_Organizacion, nombre) VALUES(?, ?)",
                [formulario.insertId, testigo]);
        }
        
        return res.status(201).json({
            ok: true, 
            msg: "Organización creada exitosamente",
            id_Organizacion: formulario.insertId
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

const procesarArchivo = async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No se proporcionó ningún archivo.');
    }

    try {
        const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
        
        const htmlContent = result.value; // El HTML extraído
        const messages = result.messages; // Advertencias o errores

        res.json({
            ok: true,
            html: htmlContent,
            warnings: messages
        });

    }catch(error){
        console.error('Error procesando el archivo DOCX:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Error interno del servidor al convertir el archivo.' 
        });
    }
}

const actualizarOrganizacion = async (req, res) => {
    const con = await db.getConnection();
    const { id_Organizacion } = req.params;
    const {
        rfc,
        nombre_Legal,
        nombre_Comercial,
        nombre_Titular,
        puesto_Titular,
        numero_Escritura,
        nombre_Notario,
        numero_Notaria,
        notaria_Estado,
        notaria_Municipio,
        actividades,
        domicilio_Calle,
        domicilio_Estado,
        domicilio_Municipio,
        domicilio_CP,
        contacto_Telefono,
        contacto_Email,
        oficio_Nombramiento,
        fecha_Nombramiento,
        ine_Representante,
        acta_constitutiva,
        tipo,
        testigos
    } = req.body;

    try {
        // Verificar que existe la organización
        const [existingOrg] = await con.query(
            "SELECT * FROM Organizaciones WHERE id_Organizacion = ?",
            [id_Organizacion]
        );

        if (existingOrg.length < 1) {
            return res.status(404).json({ ok: false, msg: "Organización no encontrada" });
        }

        // Actualizar organización
        await con.query(
            `UPDATE Organizaciones SET 
            rfc = ?, nombre_Legal = ?, nombre_Comercial = ?, nombre_Titular = ?, 
            puesto_Titular = ?, numero_Escritura = ?, nombre_Notario = ?,
            numero_Notaria = ?, notaria_Estado = ?, notaria_Municipio = ?, actividades = ?, 
            domicilio_Calle = ?, domicilio_Estado = ?, domicilio_Municipio = ?, 
            domicilio_CP = ?, contacto_Telefono = ?, contacto_Email = ?, 
            oficio_Nombramiento = ?, fecha_Nombramiento = ?, ine_Representante = ?, 
            acta_constitutiva = ?, tipo = ?
            WHERE id_Organizacion = ?`,
            [rfc, nombre_Legal, nombre_Comercial, nombre_Titular, puesto_Titular, 
             numero_Escritura, nombre_Notario, numero_Notaria, notaria_Estado, notaria_Municipio,
             actividades, domicilio_Calle, domicilio_Estado, domicilio_Municipio, 
             domicilio_CP, contacto_Telefono, contacto_Email, oficio_Nombramiento, 
             fecha_Nombramiento, ine_Representante, acta_constitutiva, tipo, id_Organizacion]
        );

        // Actualizar testigos - primero eliminar los existentes
        await con.query("DELETE FROM Testigos WHERE id_Organizacion = ?", [id_Organizacion]);
        
        // Insertar nuevos testigos
        if (testigos && testigos.length > 0) {
            for (const testigo of testigos) {
                if (testigo && testigo.trim()) {
                    await con.query(
                        "INSERT INTO Testigos(id_Organizacion, nombre) VALUES(?, ?)",
                        [id_Organizacion, testigo]
                    );
                }
            }
        }
        
        return res.status(200).json({
            ok: true, 
            msg: "Organización actualizada exitosamente"
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ ok: false, message: 'Algo salió mal' });
    } finally {
        con.release();
    }
}

module.exports = {
    registrarOrganizacion,
    procesarArchivo,
    actualizarOrganizacion
}