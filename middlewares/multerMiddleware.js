import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsPath = process.env.UPLOADS_DIR || "uploads/convenios";
    const tempDir = path.isAbsolute(uploadsPath) 
      ? uploadsPath 
      : path.join(process.cwd(), uploadsPath);
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    cb(null, tempDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["application/pdf"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Tipo de archivo no permitido"), false);
};

export const uploadMultipleFields = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
}).fields([
  { name: "Acta", maxCount: 1 },                  
  { name: "Poder", maxCount: 1 },                 
  { name: "AltaHacienda", maxCount: 1 },          
  { name: "Identificacion", maxCount: 1 },        
  { name: "Comprobante", maxCount: 1 },           
  { name: "ConvenioFirmado", maxCount: 1 },      
  { name: "Nombramiento", maxCount: 1 },        
]);
