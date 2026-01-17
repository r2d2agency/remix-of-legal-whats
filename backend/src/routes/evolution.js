import { Router } from 'express';
import { query } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

// Helper to make Evolution API requests
async function evolutionRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${EVOLUTION_API_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const text = await response.text();
    console.error('Evolution API error:', response.status, text);
    throw new Error(`Evolution API error: ${response.status}`);
  }

  return response.json();
}

// Generate unique instance name
function generateInstanceName(orgId, oddsStr) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ws_${(orgId || oddsStr || 'default').substring(0, 8)}_${timestamp}${random}`;
}

// Check plan limits for connections
async function checkConnectionLimit(userId, organizationId) {
  if (organizationId) {
    // Check organization's plan limits
    const result = await query(
      `SELECT 
         p.max_connections,
         p.name as plan_name,
         (SELECT COUNT(*) FROM connections WHERE organization_id = o.id) as current_connections
       FROM organizations o
       LEFT JOIN plans p ON p.id = o.plan_id
       WHERE o.id = $1`,
      [organizationId]
    );

    if (result.rows.length === 0) {
      throw new Error('Organização não encontrada');
    }

    const { max_connections, current_connections, plan_name } = result.rows[0];
    const limit = max_connections || 1;
    
    if (current_connections >= limit) {
      throw new Error(`Limite de conexões atingido (${current_connections}/${limit}). Plano: ${plan_name || 'Sem plano'}. Faça upgrade.`);
    }

    return { allowed: true, current: current_connections, limit };
  } else {
    // Fallback: check user's own connections (for users without organization)
    const result = await query(
      `SELECT COUNT(*) as current_connections FROM connections WHERE user_id = $1`,
      [userId]
    );

    const currentConnections = parseInt(result.rows[0].current_connections) || 0;
    const defaultLimit = 1; // Default limit for users without organization

    if (currentConnections >= defaultLimit) {
      throw new Error(`Limite de conexões atingido (${currentConnections}/${defaultLimit}). Associe-se a uma organização.`);
    }

    return { allowed: true, current: currentConnections, limit: defaultLimit };
  }
}

// Get plan limits for connections
router.get('/limits', authenticate, async (req, res) => {
  try {
    // Get user's organization
    const orgResult = await query(
      `SELECT om.organization_id 
       FROM organization_members om 
       WHERE om.user_id = $1 
       LIMIT 1`,
      [req.userId]
    );

    if (orgResult.rows.length === 0) {
      return res.json({
        max_connections: 1,
        current_connections: 0,
        plan_name: 'Sem organização'
      });
    }

    const organizationId = orgResult.rows[0].organization_id;

    // Get plan limits
    const limitsResult = await query(
      `SELECT 
         p.max_connections,
         p.name as plan_name,
         (SELECT COUNT(*) FROM connections WHERE organization_id = o.id) as current_connections
       FROM organizations o
       LEFT JOIN plans p ON p.id = o.plan_id
       WHERE o.id = $1`,
      [organizationId]
    );

    if (limitsResult.rows.length === 0) {
      return res.json({
        max_connections: 1,
        current_connections: 0,
        plan_name: 'Organização não encontrada'
      });
    }

    const { max_connections, current_connections, plan_name } = limitsResult.rows[0];

    res.json({
      max_connections: max_connections || 1,
      current_connections: parseInt(current_connections) || 0,
      plan_name: plan_name || 'Sem plano'
    });
  } catch (error) {
    console.error('Get limits error:', error);
    res.status(500).json({ error: 'Erro ao buscar limites' });
  }
});

// Create new Evolution instance
router.post('/create', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    let { organization_id } = req.body;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      return res.status(500).json({ error: 'Evolution API não configurada' });
    }

    // If no organization_id provided, get user's first organization
    if (!organization_id) {
      const orgResult = await query(
        `SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1`,
        [req.userId]
      );
      if (orgResult.rows.length > 0) {
        organization_id = orgResult.rows[0].organization_id;
      }
    }

    // Verify user belongs to organization
    if (organization_id) {
      const memberCheck = await query(
        `SELECT id, role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organization_id, req.userId]
      );
      if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Você não pertence a esta organização' });
      }
      // Only owner, admin, manager can create connections
      if (!['owner', 'admin', 'manager'].includes(memberCheck.rows[0].role)) {
        return res.status(403).json({ error: 'Sem permissão para criar conexões' });
      }
    }

    // Check plan limits
    await checkConnectionLimit(req.userId, organization_id);

    // Generate unique instance name
    const instanceName = generateInstanceName(organization_id, req.userId);

    // Create instance on Evolution API
    const createResult = await evolutionRequest('/instance/create', 'POST', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    });

    console.log('Evolution create result:', createResult);

    // Save connection to database
    const dbResult = await query(
      `INSERT INTO connections (user_id, organization_id, name, instance_name, api_url, api_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'disconnected')
       RETURNING *`,
      [req.userId, organization_id || null, name || 'WhatsApp', instanceName, EVOLUTION_API_URL, EVOLUTION_API_KEY]
    );

    const connection = dbResult.rows[0];

    // Get QR code
    let qrCode = null;
    try {
      const qrResult = await evolutionRequest(`/instance/connect/${instanceName}`, 'GET');
      qrCode = qrResult.base64 || qrResult.qrcode?.base64 || null;
    } catch (e) {
      console.log('QR code not ready yet');
    }

    res.status(201).json({
      ...connection,
      qrCode,
    });
  } catch (error) {
    console.error('Create Evolution instance error:', error);
    res.status(400).json({ error: error.message || 'Erro ao criar instância' });
  }
});

// Get QR Code for connection
router.get('/:connectionId/qrcode', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND user_id = $2',
      [connectionId, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Get QR code from Evolution
    const qrResult = await evolutionRequest(`/instance/connect/${connection.instance_name}`, 'GET');
    
    res.json({
      qrCode: qrResult.base64 || qrResult.qrcode?.base64 || null,
      pairingCode: qrResult.pairingCode || null,
    });
  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({ error: 'Erro ao buscar QR Code' });
  }
});

// Check connection status
router.get('/:connectionId/status', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND user_id = $2',
      [connectionId, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Check status on Evolution
    const statusResult = await evolutionRequest(`/instance/connectionState/${connection.instance_name}`, 'GET');
    
    const isConnected = statusResult.instance?.state === 'open';
    const phoneNumber = statusResult.instance?.phoneNumber || null;
    const newStatus = isConnected ? 'connected' : 'disconnected';

    // Update status in database if changed
    if (connection.status !== newStatus || connection.phone_number !== phoneNumber) {
      await query(
        'UPDATE connections SET status = $1, phone_number = $2, updated_at = NOW() WHERE id = $3',
        [newStatus, phoneNumber, connectionId]
      );
    }

    res.json({
      status: newStatus,
      phoneNumber,
      state: statusResult.instance?.state,
    });
  } catch (error) {
    console.error('Check status error:', error);
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// Disconnect/Logout from WhatsApp
router.post('/:connectionId/logout', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND user_id = $2',
      [connectionId, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Logout from Evolution
    await evolutionRequest(`/instance/logout/${connection.instance_name}`, 'DELETE');

    // Update status in database
    await query(
      'UPDATE connections SET status = $1, phone_number = NULL, updated_at = NOW() WHERE id = $2',
      ['disconnected', connectionId]
    );

    res.json({ success: true, message: 'Desconectado com sucesso' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

// Restart instance (reconnect)
router.post('/:connectionId/restart', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND user_id = $2',
      [connectionId, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Restart instance on Evolution
    try {
      await evolutionRequest(`/instance/restart/${connection.instance_name}`, 'PUT');
    } catch (e) {
      // If restart fails, try to create the instance again
      await evolutionRequest('/instance/create', 'POST', {
        instanceName: connection.instance_name,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
    }

    // Update status in database
    await query(
      'UPDATE connections SET status = $1, updated_at = NOW() WHERE id = $2',
      ['disconnected', connectionId]
    );

    // Get new QR code
    const qrResult = await evolutionRequest(`/instance/connect/${connection.instance_name}`, 'GET');

    res.json({
      success: true,
      qrCode: qrResult.base64 || qrResult.qrcode?.base64 || null,
    });
  } catch (error) {
    console.error('Restart error:', error);
    res.status(500).json({ error: 'Erro ao reiniciar instância' });
  }
});

// Delete instance completely
router.delete('/:connectionId', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND user_id = $2',
      [connectionId, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Delete instance from Evolution
    try {
      await evolutionRequest(`/instance/delete/${connection.instance_name}`, 'DELETE');
    } catch (e) {
      console.log('Instance may not exist on Evolution:', e.message);
    }

    // Delete from database
    await query('DELETE FROM connections WHERE id = $1', [connectionId]);

    res.json({ success: true, message: 'Conexão excluída com sucesso' });
  } catch (error) {
    console.error('Delete instance error:', error);
    res.status(500).json({ error: 'Erro ao excluir conexão' });
  }
});

// Get instance info
router.get('/:connectionId/info', authenticate, async (req, res) => {
  try {
    const { connectionId } = req.params;

    // Get connection
    const connResult = await query(
      'SELECT * FROM connections WHERE id = $1 AND user_id = $2',
      [connectionId, req.userId]
    );

    if (connResult.rows.length === 0) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const connection = connResult.rows[0];

    // Get instance info from Evolution
    const infoResult = await evolutionRequest(`/instance/fetchInstances?instanceName=${connection.instance_name}`, 'GET');

    res.json({
      connection,
      instanceInfo: infoResult[0] || null,
    });
  } catch (error) {
    console.error('Get instance info error:', error);
    res.status(500).json({ error: 'Erro ao buscar informações' });
  }
});

export default router;
