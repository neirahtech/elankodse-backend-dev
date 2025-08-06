import express from 'express';
import {
  getBooks,
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  updateBookOrder
} from '../controllers/bookController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/', getBooks); // Get active books only
router.get('/:id', getBookById); // Get single book

// Protected routes (admin only)
router.get('/admin/all', auth, getAllBooks); // Get all books including inactive
router.post('/', auth, createBook); // Create book
router.put('/:id', auth, updateBook); // Update book
router.delete('/:id', auth, deleteBook); // Delete book
router.put('/admin/reorder', auth, updateBookOrder); // Update book order

export default router;
