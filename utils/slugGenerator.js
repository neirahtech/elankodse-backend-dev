/**
 * Generate URL-friendly slug from title
 * @param {string} title - The title to convert to slug
 * @returns {string} - URL-friendly slug
 */
export function generateSlug(title) {
  if (!title) return '';
  
  return title
    .toLowerCase()
    .trim()
    // Replace Tamil characters with their transliterated equivalents
    .replace(/[அ-ஹ]/g, (char) => {
      const tamilMap = {
        'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ii', 'உ': 'u', 'ஊ': 'uu',
        'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au',
        'க': 'ka', 'ங': 'nga', 'ச': 'cha', 'ஞ': 'nya', 'ட': 'ta', 'ண': 'na',
        'த': 'tha', 'ந': 'na', 'ப': 'pa', 'ம': 'ma', 'ய': 'ya', 'ர': 'ra',
        'ல': 'la', 'வ': 'va', 'ழ': 'zha', 'ள': 'la', 'ற': 'ra', 'ன': 'na',
        'ஜ': 'ja', 'ஷ': 'sha', 'ஸ': 'sa', 'ஹ': 'ha', 'க்ஷ': 'ksha'
      };
      return tamilMap[char] || char;
    })
    // Replace spaces and special characters with hyphens
    .replace(/[\s\-_]+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^\w\-]/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading and trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Limit length
    .substring(0, 100);
}

/**
 * Generate unique slug by appending number if needed
 * @param {string} title - The title to convert to slug
 * @param {Function} checkExists - Function to check if slug exists
 * @returns {Promise<string>} - Unique slug
 */
export async function generateUniqueSlug(title, checkExists) {
  let slug = generateSlug(title);
  let counter = 1;
  let uniqueSlug = slug;
  
  while (await checkExists(uniqueSlug)) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }
  
  return uniqueSlug;
}

/**
 * Check if a slug is valid
 * @param {string} slug - The slug to validate
 * @returns {boolean} - True if valid
 */
export function isValidSlug(slug) {
  return /^[a-z0-9\-]+$/.test(slug) && slug.length > 0 && slug.length <= 100;
}
