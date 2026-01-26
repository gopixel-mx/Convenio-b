async function handleTokenVerification(req, res) {
  try {
    const cuenta = req.user;

    const { passwordHash, ...safeData } = cuenta;

    return res.status(200).json({
      message: 'Token válido',
      cuenta: safeData
    });
  } catch (error) {
    console.error('Error en handleTokenVerification:', error.message);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { handleTokenVerification };
