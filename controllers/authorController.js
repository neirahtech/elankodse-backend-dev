import Author from '../models/Author.js';

export const getAuthor = async (req, res) => {
  try {
    const author = await Author.findOne({});
    res.json(author);
  } catch (err) {
    console.error('Error fetching author:', err);
    res.status(500).json({ error: 'Failed to fetch author' });
  }
}; 