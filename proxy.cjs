const express = require('express');
const axios = require('axios');
const cors = require('cors');
const xml2js = require('xml2js');

const app = express();

// Configure CORS properly
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://elankodse.com',
    'https://www.elankodse.com',
    'https://digitalocean.elankodse.com',
    'http://digitalocean.elankodse.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.use(express.json());

// Endpoint to fetch and parse the RSS feed
app.get('/api/elanko-dse', async (req, res) => {
  try {
    const rssUrl = 'https://djthamilan.blogspot.com/feeds/posts/default?alt=rss';
    const response = await axios.get(rssUrl, { timeout: 10000 });
    const xml = response.data;

    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('XML parsing error:', err);
        return res.status(500).json({ error: 'Failed to parse RSS', details: err.message });
      }
      const items = result.rss.channel.item;
      res.json(items);
    });
  } catch (error) {
    console.error('RSS fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch data', 
      details: error.message,
      url: 'https://djthamilan.blogspot.com/feeds/posts/default?alt=rss'
    });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Proxy server running on port ${PORT}`)); 