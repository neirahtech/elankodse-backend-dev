import Book from '../models/Book.js';
import config from '../config/environment.js';

// Utility function to convert image URLs to current environment
const convertImageUrl = (imageUrl) => {
  // Return null/empty values as-is without processing
  if (!imageUrl || imageUrl.trim() === '') return imageUrl;
  
  // If it's already a full URL or starts with http/https, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a relative path that starts with '/uploads/', convert to full URL
  if (imageUrl.startsWith('/uploads/')) {
    // Use production URL if forced or in production environment
    if (config.forceProductionUrls || config.isProduction) {
      return `${config.productionUrl}${imageUrl}`;
    }
    
    // Return URL for current local environment
    const currentBaseUrl = config.getServerUrl();
    return `${currentBaseUrl}${imageUrl}`;
  }
  
  // For other paths (like /src/assets/...), return as-is
  return imageUrl;
};

// Utility function to process book data with correct image URLs
const processBookData = (book) => {
  const bookData = book.toJSON ? book.toJSON() : book;
  return {
    ...bookData,
    coverImage: convertImageUrl(bookData.coverImage)
  };
};

// Get all books (public endpoint)
export const getBooks = async (req, res) => {
  try {
    const books = await Book.findAll({
      where: {
        isActive: true
      },
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']]
    });
    
    // Process books to ensure correct image URLs for current environment
    const processedBooks = books.map(processBookData);
    
    res.json(processedBooks);
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
};

// Get all books including inactive (admin only)
export const getAllBooks = async (req, res) => {
  try {
    const books = await Book.findAll({
      order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']]
    });
    
    // Process books to ensure correct image URLs for current environment
    const processedBooks = books.map(processBookData);
    
    res.json(processedBooks);
  } catch (error) {
    console.error('Error fetching all books:', error);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
};

// Get single book by ID
export const getBookById = async (req, res) => {
  try {
    const { id } = req.params;
    const book = await Book.findByPk(id);
    
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    
    // Process book to ensure correct image URL for current environment
    const processedBook = processBookData(book);
    
    res.json(processedBook);
  } catch (error) {
    console.error('Error fetching book:', error);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
};

// Create new book (admin only)
export const createBook = async (req, res) => {
  try {
    const {
      title,
      originalTitle,
      description,
      coverImage,
      category,
      linkType,
      linkValue,
      publishedYear,
      genre,
      isActive,
      sortOrder
    } = req.body;

    // Validation
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Create the book
    const book = await Book.create({
      title,
      originalTitle,
      description,
      coverImage,
      category,
      linkType: linkType || 'category',
      linkValue,
      publishedYear,
      genre,
      isActive: isActive !== undefined ? isActive : true,
      sortOrder: sortOrder || 0
    });

    res.status(201).json(book);
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
};

// Update book (admin only)
export const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      originalTitle,
      description,
      coverImage,
      category,
      linkType,
      linkValue,
      publishedYear,
      genre,
      isActive,
      sortOrder
    } = req.body;

    const book = await Book.findByPk(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    // Update the book
    await book.update({
      title,
      originalTitle,
      description,
      coverImage,
      category,
      linkType,
      linkValue,
      publishedYear,
      genre,
      isActive,
      sortOrder
    });

    res.json(book);
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
};

// Delete book (admin only)
export const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    
    const book = await Book.findByPk(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    await book.destroy();
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
};

// Update book sort order (admin only)
export const updateBookOrder = async (req, res) => {
  try {
    const { books } = req.body; // Array of {id, sortOrder}
    
    if (!Array.isArray(books)) {
      return res.status(400).json({ error: 'Books array is required' });
    }

    // Update sort order for each book
    for (const bookData of books) {
      if (bookData.id && bookData.sortOrder !== undefined) {
        await Book.update(
          { sortOrder: bookData.sortOrder },
          { where: { id: bookData.id } }
        );
      }
    }

    res.json({ message: 'Book order updated successfully' });
  } catch (error) {
    console.error('Error updating book order:', error);
    res.status(500).json({ error: 'Failed to update book order' });
  }
};
