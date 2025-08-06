import Book from '../models/Book.js';

export const seedBooks = async () => {
  try {
    // Check if books already exist
    const existingBooks = await Book.findAll();
    
    if (existingBooks.length === 0) {
      console.log('Seeding default books...');
      
      const defaultBooks = [
        {
          title: 'ப்யூகோவ்ஸ்கி',
          originalTitle: 'Bukowski',
          description: 'சார்ள்ஸ் ப்யூகோவ்ஸ்கி கவிதைகள் - மொழிபெயர்ப்பு',
          coverImage: '/src/assets/images/fwdbookcovers/Bukowski.jpg',
          category: 'ப்யூகோவ்ஸ்கி கவிதைகள்',
          linkType: 'category',
          linkValue: 'ப்யூகோவ்ஸ்கி கவிதைகள்',
          publishedYear: 2021,
          genre: 'மொழிபெயர்ப்பு',
          isActive: true,
          sortOrder: 1
        },
        {
          title: 'மெக்ஸிக்கோ',
          originalTitle: 'Mexico',
          description: 'பிரபஞ்சன் நினைவு நாவல் போட்டியில் 2019 -இல் பரிசு பெற்ற நாவல்',
          coverImage: '/src/assets/images/fwdbookcovers/Mexico.jpg',
          category: 'மெக்ஸிக்கோ',
          linkType: 'category',
          linkValue: 'மெக்ஸிக்கோ',
          publishedYear: 2019,
          genre: 'நாவல்',
          isActive: true,
          sortOrder: 2
        },
        {
          title: 'நாடற்றவனின் குறிப்புகள்',
          originalTitle: 'Naadatavanin Kuripukal',
          description: 'தமிழ்நாடு கலை இலக்கியப் பெருமன்றத்தின் \'ஏலாதி\' இலக்கிய விருது பெற்ற கவிதை நூல்',
          coverImage: '/src/assets/images/fwdbookcovers/Naadatavanin Kuripukal.jpg',
          category: 'நாடற்றவனின் குறிப்புகள்',
          linkType: 'post',
          linkValue: '1101597342800412053',
          publishedYear: 2007,
          genre: 'கவிதைகள்',
          isActive: true,
          sortOrder: 3
        },
        {
          title: 'நானுன்னை முத்தமிடுகையில் புத்தர் சிரித்துக்கொண்டிருந்தார்',
          originalTitle: 'Naan Unnai Muthamidukayil Buthar SirithukonduIrunthaar',
          description: 'சிறுகதைகள் - 2025',
          coverImage: '/src/assets/images/fwdbookcovers/Naan Unnai Muthamidukayil Buthar SirithukonduIrunthaar.jpg',
          category: 'நானுன்னை முத்தமிடுகையில் புத்தர் சிரித்துக்கொண்டிருந்தார்',
          linkType: 'category',
          linkValue: 'நானுன்னை முத்தமிடுகையில் புத்தர் சிரித்துக்கொண்டிருந்தார்',
          publishedYear: 2025,
          genre: 'சிறுகதைகள்',
          isActive: true,
          sortOrder: 4
        },
        {
          title: 'சாம்பல் வானத்தில் மறையும் வைரவர்',
          originalTitle: 'Sampal Vaanathil Mariyum Vairavar',
          description: 'சிறுகதைகள் - 2012',
          coverImage: '/src/assets/images/fwdbookcovers/Sampal Vaanathil Mariyum Vairavar.jpg',
          category: 'சாம்பல் வானத்தில் மறையும் வைரவர்',
          linkType: 'category',
          linkValue: 'சாம்பல் வானத்தில் மறையும் வைரவர்',
          publishedYear: 2012,
          genre: 'சிறுகதைகள்',
          isActive: true,
          sortOrder: 5
        },
        {
          title: 'தாய்லாந்து',
          originalTitle: 'Thailand',
          description: 'குறுநாவல் - 2022',
          coverImage: '/src/assets/images/fwdbookcovers/Thailand.jpg',
          category: 'தாய்லாந்து',
          linkType: 'category',
          linkValue: 'தாய்லாந்து',
          publishedYear: 2022,
          genre: 'குறுநாவல்',
          isActive: true,
          sortOrder: 6
        },
        {
          title: 'உதிரும் நினைவின் வர்ணங்கள்',
          originalTitle: 'Uthirum Nenivin Varnangal',
          description: 'திரைப்படக்கட்டுரைகள் - 2020',
          coverImage: '/src/assets/images/fwdbookcovers/Uthirum Nenivin Varnangal.jpg',
          category: 'உதிரும் நினைவின் வர்ணங்கள்',
          linkType: 'category',
          linkValue: 'உதிரும் நினைவின் வர்ணங்கள்',
          publishedYear: 2020,
          genre: 'திரைப்படக்கட்டுரைகள்',
          isActive: true,
          sortOrder: 7
        },
        {
          title: 'பேயாய் உழலும் சிறுமனமே',
          originalTitle: 'PeyaayUzhalumManame',
          description: 'கட்டுரைகள் - 2016',
          coverImage: '/src/assets/images/fwdbookcovers/PeyaayUzhalumManame.png',
          category: 'பேயாய் உழலும் சிறுமனமே',
          linkType: 'category',
          linkValue: 'பேயாய் உழலும் சிறுமனமே',
          publishedYear: 2016,
          genre: 'கட்டுரைகள்',
          isActive: true,
          sortOrder: 8
        }
      ];
      
      await Book.bulkCreate(defaultBooks);
      console.log('Default books seeded successfully');
    } else {
      console.log('Books already exist, skipping seed');
    }
  } catch (error) {
    console.error('Error seeding books:', error);
  }
};
