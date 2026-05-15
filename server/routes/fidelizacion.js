const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../utils/permissions');
const db = require('../db');
const {
  getConfig,
  updateConfig,
  acumularPuntos,
  canjearPuntos,
  procesarFidelidadPedido,
  canjearRecompensa,
  getSaldoPuntos,
  getHistorialPuntos,
  getNiveles,
  getNivelCliente,
  recalcularNivelCliente,
  recalcularTodosLosNiveles,
  procesarPuntosExpirados,
  getEstadisticas,
  calcularPuntos,
  calcularValorPuntos
} = require('../services/fidelizacionService');

// ============================================
// CONFIGURACIÓN (Admin)
// ============================================

// ... (rest of endpoints)

// POST /api/fidelizacion/recompensa/canjear
router.post('/recompensa/canjear', auth, requirePermission('pedidos.edit'), (req, res) => {
  try {
    const { cliente_id } = req.body;
    if (!cliente_id) return res.status(400).json({ error: 'cliente_id es requerido' });

    const resultado = canjearRecompensa(cliente_id);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/fidelizacion/tarjeta/:codigo
router.get('/tarjeta/:codigo', (req, res) => {
  try {
    const { codigo } = req.params;
    const cliente = db.prepare(`
      SELECT nombre, puntos, nivel, sellos_actuales, recompensas_pendientes, codigo_tarjeta 
      FROM clientes 
      WHERE codigo_tarjeta = ?
    `).get(codigo);

    if (!cliente) return res.status(404).json({ error: 'Tarjeta no encontrada' });

    const config = getConfig();
    res.json({
      cliente,
      config: {
        sellos_para_premio: config.sellos_para_premio,
        premio_descripcion: config.premio_descripcion,
        monto_minimo_sello: config.monto_minimo_sello
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fidelizacion/config
router.get('/config', auth, requirePermission('configuracion.view'), (req, res) => {
  try {
    const config = getConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/fidelizacion/config
router.put('/config', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const config = updateConfig(req.body);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// NIVELES (Admin)
// ============================================

// GET /api/fidelizacion/niveles
router.get('/niveles', auth, (req, res) => {
  try {
    const niveles = getNiveles();
    res.json(niveles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fidelizacion/niveles/:clienteId
router.get('/niveles/cliente/:clienteId', auth, (req, res) => {
  try {
    const nivel = getNivelCliente(req.params.clienteId);
    if (!nivel) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json(nivel);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/fidelizacion/niveles/recalcular
router.post('/niveles/recalcular', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const resultado = recalcularTodosLosNiveles();
    res.json({ 
      mensaje: 'Niveles recalculados',
      cambios: resultado.length,
      detalles: resultado
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/fidelizacion/niveles/recalcular/:clienteId
router.post('/niveles/recalcular/:clienteId', auth, requirePermission('clientes.edit'), (req, res) => {
  try {
    const resultado = recalcularNivelCliente(req.params.clienteId);
    res.json(resultado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PUNTOS - Cliente (propios o con permiso)
// ============================================

// GET /api/fidelizacion/puntos/saldo/:clienteId
router.get('/puntos/saldo/:clienteId', auth, (req, res) => {
  try {
    // TODO: Verificar que el usuario puede ver este cliente
    const saldo = getSaldoPuntos(req.params.clienteId);
    const config = getConfig();
    res.json({
      puntos: saldo,
      valor_aproximado: saldo * config.valor_punto_real,
      minimo_canje: config.minimo_canje,
      puede_canjear: saldo >= config.minimo_canje && config.activo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/fidelizacion/puntos/historial/:clienteId
router.get('/puntos/historial/:clienteId', auth, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const historial = getHistorialPuntos(req.params.clienteId, limit);
    res.json(historial);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/fidelizacion/puntos/canjear
router.post('/puntos/canjear', auth, requirePermission('pedidos.edit'), (req, res) => {
  try {
    const { cliente_id, puntos, descripcion } = req.body;
    
    if (!cliente_id || !puntos) {
      return res.status(400).json({ error: 'cliente_id y puntos son requeridos' });
    }

    const resultado = canjearPuntos(cliente_id, puntos, descripcion || 'Canje manual');
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/fidelizacion/puntos/acumular
router.post('/puntos/acumular', auth, requirePermission('pedidos.edit'), (req, res) => {
  try {
    const { cliente_id, pedido_id, total, descripcion } = req.body;
    
    if (!cliente_id || !total) {
      return res.status(400).json({ error: 'cliente_id y total son requeridos' });
    }

    const resultado = acumularPuntos(cliente_id, pedido_id, total, descripcion);
    res.json({
      success: true,
      ...resultado
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CALCULADORA (Pública)
// ============================================

// GET /api/fidelizacion/calcular/:total
router.get('/calcular/:total', (req, res) => {
  try {
    const total = parseFloat(req.params.total);
    const config = getConfig();
    
    if (!config.activo) {
      return res.json({ activo: false });
    }

    const puntosBase = calcularPuntos(total, 1);
    
    // Calcular para cada nivel
    const niveles = getNiveles();
    const porNivel = niveles.map(n => ({
      nivel: n.nombre,
      multiplicador: n.multiplicador_puntos,
      puntos: calcularPuntos(total, n.multiplicador_puntos)
    }));

    res.json({
      activo: true,
      total_compra: total,
      puntos_base: puntosBase,
      por_nivel: porNivel,
      config: {
        pesos_por_punto: config.pesos_por_punto,
        valor_punto_real: config.valor_punto_real
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ESTADÍSTICAS (Admin)
// ============================================

// GET /api/fidelizacion/estadisticas
router.get('/estadisticas', auth, requirePermission('reportes.view'), (req, res) => {
  try {
    const stats = getEstadisticas();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MANTENIMIENTO (Admin/Sistema)
// ============================================

// POST /api/fidelizacion/mantenimiento/expirar
router.post('/mantenimiento/expirar', auth, requirePermission('config.manage'), (req, res) => {
  try {
    const expirados = procesarPuntosExpirados();
    res.json({ 
      mensaje: 'Proceso de expiración completado',
      puntos_expirados: expirados
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
