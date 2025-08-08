import { getUrls } from '../config/constants.js';

export const generatePostHTML = (metaData) => {
  const urls = getUrls();
  
  return `<!DOCTYPE html>
<html lang="ta">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Basic SEO Meta Tags -->
    <title>${metaData.title} | Elanko</title>
    <meta name="description" content="${metaData.description}" />
    <meta name="author" content="${metaData.author}" />
    <meta name="robots" content="index, follow" />
    <meta name="language" content="Tamil" />
    <meta name="theme-color" content="#1e40af" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:title" content="${metaData.title}" />
    <meta property="og:description" content="${metaData.description}" />
    <meta property="og:image" content="${metaData.image}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${metaData.url}" />
    <meta property="og:type" content="${metaData.type}" />
    <meta property="og:site_name" content="${metaData.siteName}" />
    <meta property="og:locale" content="ta_IN" />
    
    <!-- Article-specific Open Graph tags -->
    <meta property="article:published_time" content="${metaData.publishedTime}" />
    <meta property="article:author" content="${metaData.author}" />
    <meta property="article:section" content="${metaData.category}" />
    
    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@elankodse" />
    <meta name="twitter:creator" content="@elankodse" />
    <meta name="twitter:title" content="${metaData.title}" />
    <meta name="twitter:description" content="${metaData.description}" />
    <meta name="twitter:image" content="${metaData.image}" />
    
    <!-- LinkedIn specific -->
    <meta property="linkedin:title" content="${metaData.title}" />
    <meta property="linkedin:description" content="${metaData.description}" />
    <meta property="linkedin:image" content="${metaData.image}" />
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${metaData.url}" />
    
    <!-- Redirect to frontend after meta tags are loaded -->
    <script>
      // For social media crawlers, they'll read the meta tags above
      // For real users, redirect to the frontend React app
      if (!navigator.userAgent.includes('bot') && !navigator.userAgent.includes('crawler')) {
        window.location.href = '${urls.frontend}/post/${metaData.url.split('/').pop()}';
      }
    </script>
  </head>
  <body>
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
      <h1 style="color: #1e40af; margin-bottom: 20px;">${metaData.title}</h1>
      <p style="color: #666; font-size: 18px; line-height: 1.6; margin-bottom: 30px;">${metaData.description}</p>
      <img src="${metaData.image}" alt="${metaData.title}" style="max-width: 100%; height: auto; border-radius: 8px; margin-bottom: 20px;" />
      <p style="color: #999; font-size: 14px;">
        By ${metaData.author} • ${new Date(metaData.publishedTime).toLocaleDateString('ta-IN')}
      </p>
      <p style="color: #999; font-size: 14px; margin-top: 20px;">
        This page will redirect to the full article shortly...
      </p>
      <noscript>
        <a href="${urls.frontend}/post/${metaData.url.split('/').pop()}" style="color: #1e40af; text-decoration: none; font-weight: bold;">
          Click here to read the full article
        </a>
      </noscript>
    </div>
  </body>
</html>`;
};

export const generateBookHTML = (metaData) => {
  const urls = getUrls();
  
  return `<!DOCTYPE html>
<html lang="ta">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    
    <!-- Basic SEO Meta Tags -->
    <title>${metaData.title} | Elanko</title>
    <meta name="description" content="${metaData.description}" />
    <meta name="author" content="${metaData.author}" />
    <meta name="robots" content="index, follow" />
    <meta name="language" content="Tamil" />
    <meta name="theme-color" content="#1e40af" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:title" content="${metaData.title}" />
    <meta property="og:description" content="${metaData.description}" />
    ${metaData.image ? `<meta property="og:image" content="${metaData.image}" />` : ''}
    ${metaData.image ? `<meta property="og:image:width" content="1200" />` : ''}
    ${metaData.image ? `<meta property="og:image:height" content="630" />` : ''}
    <meta property="og:url" content="${metaData.url}" />
    <meta property="og:type" content="book" />
    <meta property="og:site_name" content="${metaData.siteName}" />
    <meta property="og:locale" content="ta_IN" />
    
    <!-- Book-specific Open Graph tags -->
    <meta property="book:author" content="${metaData.author}" />
    <meta property="book:isbn" content="" />
    <meta property="book:release_date" content="${metaData.publishedTime}" />
    <meta property="book:tag" content="${metaData.category}" />
    
    <!-- Twitter Cards -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:site" content="@elankodse" />
    <meta name="twitter:creator" content="@elankodse" />
    <meta name="twitter:title" content="${metaData.title}" />
    <meta name="twitter:description" content="${metaData.description}" />
    ${metaData.image ? `<meta name="twitter:image" content="${metaData.image}" />` : ''}
    
    <!-- LinkedIn specific -->
    <meta property="linkedin:title" content="${metaData.title}" />
    <meta property="linkedin:description" content="${metaData.description}" />
    ${metaData.image ? `<meta property="linkedin:image" content="${metaData.image}" />` : ''}
    
    <!-- Canonical URL -->
    <link rel="canonical" href="${metaData.url}" />
    
    <!-- Structured Data for Books -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Book",
      "name": "${metaData.title}",
      "author": {
        "@type": "Person",
        "name": "${metaData.author}"
      },
      "description": "${metaData.description}",${metaData.image ? `
      "image": "${metaData.image}",` : ''}
      "url": "${metaData.url}",
      "inLanguage": "ta-IN",
      "genre": "${metaData.category}",
      "publisher": {
        "@type": "Organization",
        "name": "Independent"
      },
      "datePublished": "${metaData.publishedTime}"
    }
    </script>
    
    <!-- Redirect to frontend after meta tags are loaded -->
    <script>
      // For social media crawlers, they'll read the meta tags above
      // For real users, redirect to the frontend React app
      if (!navigator.userAgent.includes('bot') && !navigator.userAgent.includes('crawler')) {
        window.location.href = '${urls.frontend}/book/${metaData.url.split('/').pop()}';
      }
    </script>
  </head>
  <body>
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; text-align: center;">
      <h1 style="color: #1e40af; margin-bottom: 20px;">${metaData.title}</h1>
      <p style="color: #666; font-size: 18px; line-height: 1.6; margin-bottom: 30px;">${metaData.description}</p>
      ${metaData.image ? `<img src="${metaData.image}" alt="${metaData.title}" style="max-width: 300px; height: auto; border-radius: 8px; margin-bottom: 20px;" />` : ''}
      <p style="color: #999; font-size: 14px;">
        By ${metaData.author} ${metaData.publishedTime ? '• ' + new Date(metaData.publishedTime).getFullYear() : ''}
      </p>
      <p style="color: #999; font-size: 14px; margin-top: 20px;">
        This page will redirect to the book details shortly...
      </p>
      <noscript>
        <a href="${urls.frontend}/book/${metaData.url.split('/').pop()}" style="color: #1e40af; text-decoration: none; font-weight: bold;">
          Click here to view book details
        </a>
      </noscript>
    </div>
  </body>
</html>`;
};
