const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser, deleteUser } = require('../controllers/users.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(verifyToken);

// Get all users (admin only)
router.get('/', isAdmin, getAllUsers);

// Get user by ID
router.get('/:id', getUserById);

// Update user
router.put('/:id', updateUser);

// Delete user (admin only)
router.delete('/:id', isAdmin, deleteUser);

module.exports = router;
