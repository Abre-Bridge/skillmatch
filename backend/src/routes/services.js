const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

// GET /api/services - Get all services with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, min_price, max_price, location, sort, limit = 20, offset = 0 } = req.query;

    let sql = `
      SELECT s.*, 
             json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as users
      FROM services s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true
    `;
    const params = [];
    let paramCount = 1;

    if (category && category !== 'All') {
      sql += ` AND s.category = $${paramCount++}`;
      params.push(category);
    }
    if (min_price) {
      sql += ` AND s.price >= $${paramCount++}`;
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      sql += ` AND s.price <= $${paramCount++}`;
      params.push(parseFloat(max_price));
    }
    if (location) {
      sql += ` AND s.location ILIKE $${paramCount++}`;
      params.push(`%${location}%`);
    }

    if (sort === 'price_asc') {
      sql += ' ORDER BY s.price ASC';
    } else if (sort === 'price_desc') {
      sql += ' ORDER BY s.price DESC';
    } else if (sort === 'rating') {
      sql += ' ORDER BY s.rating DESC';
    } else {
      sql += ' ORDER BY s.created_at DESC';
    }

    sql += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);
    
    // Convert users object appropriately equivalent to Supabase response
    const formattedData = rows.map(r => ({
      ...r,
      users: r.users
    }));

    res.json({ services: formattedData, count: rows.length });
  } catch (error) {
    console.error('Services fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// GET /api/services/featured - Get featured services
router.get('/featured', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT s.*, 
             json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as users
      FROM services s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true AND s.is_featured = true
      ORDER BY s.rating DESC
      LIMIT 10
    `);

    res.json({ services: rows });
  } catch (error) {
    console.error('Featured fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch featured services' });
  }
});

// GET /api/services/categories - Get distinct categories
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM categories ORDER BY name');
    res.json({ categories: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/services/:id - Get single service
router.get('/:id', async (req, res) => {
  try {
    const serviceRes = await query(`
      SELECT s.*, 
             json_build_object('id', u.id, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'phone_number', u.phone_number) as users
      FROM services s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `, [req.params.id]);

    if (serviceRes.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const service = serviceRes.rows[0];

    // Fetch reviews
    const reviewsRes = await query(`
      SELECT r.*, json_build_object('display_name', u.display_name, 'avatar_url', u.avatar_url) as users
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.service_id = $1
      ORDER BY r.created_at DESC
    `, [req.params.id]);

    service.reviews = reviewsRes.rows;

    res.json({ service });
  } catch (error) {
    console.error('Service details error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/services - Create a new service
router.post('/', async (req, res) => {
  try {
    const {
      user_id, title, description, category, price, price_type,
      location, latitude, longitude, images, tags
    } = req.body;

    if (!user_id || !title || !description || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const insertSql = `
      INSERT INTO services (
        user_id, title, description, category, price, price_type,
        location, latitude, longitude, images, tags,
        rating, review_count, is_active, is_featured, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, true, false, NOW(), NOW()
      ) RETURNING *
    `;

    const params = [
      user_id, title, description, category, price || 0, price_type || 'negotiable',
      location || '', latitude || null, longitude || null, images || '{}', tags || '{}'
    ];

    const { rows } = await query(insertSql, params);

    console.log(`[SERVICE ADDED] ID: ${rows[0].id} | Title: ${rows[0].title} | User: ${rows[0].user_id}`);

    res.status(201).json({ service: rows[0] });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

// POST /api/services/:id/reviews - Add a review and update aggregates
router.post('/:id/reviews', async (req, res) => {
  try {
    const { user_id, rating, content } = req.body;
    if (!user_id || !rating) return res.status(400).json({ error: 'Missing fields' });

    // Insert the review
    await query(
      'INSERT INTO reviews (service_id, user_id, rating, content) VALUES ($1, $2, $3, $4)', 
      [req.params.id, user_id, rating, content || '']
    );
    
    // Update service rating rolling average and count dynamically
    await query(`
      UPDATE services 
      SET rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE service_id = $1),
          review_count = (SELECT COUNT(*) FROM reviews WHERE service_id = $1)
      WHERE id = $1
    `, [req.params.id]);

    res.json({ success: true, message: 'Rating applied' });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// PUT /api/services/:id - Update a service
router.put('/:id', async (req, res) => {
  // Simplified for brevity, in a real app would build dynamic SET clause
  res.status(501).json({ error: 'Not implemented in this refactor version' });
});

// DELETE /api/services/:id - Delete a service
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM services WHERE id = $1', [req.params.id]);
    res.json({ message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

module.exports = router;
