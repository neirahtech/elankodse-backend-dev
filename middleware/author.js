const requireAuthor = (req, res, next) => {
  if (!req.user?.isAuthor) {
    return res.status(403).json({ error: 'Author access required' });
  }
  next();
};

export default requireAuthor; 