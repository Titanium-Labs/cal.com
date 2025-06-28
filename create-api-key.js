const { randomBytes, createHash } = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Hash the API key (same as cal.com does)
const hashAPIKey = (apiKey) => createHash('sha256').update(apiKey).digest('hex');

// Generate a unique API key (same as cal.com does)
const generateUniqueAPIKey = (apiKey = randomBytes(16).toString('hex')) => [
  hashAPIKey(apiKey),
  apiKey,
];

// Database connection setup
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Set it to your Render PostgreSQL connection string');
  process.exit(1);
}

async function createApiKey() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  });

  try {
    console.log('🔗 Connecting to database...');
    
    // Check if any users exist
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in database`);
    
    let userId;
    
    if (userCount === 0) {
      console.log('👤 No users found. Creating a new user...');
      
      // Create a new user
      const newUser = await prisma.user.create({
        data: {
          email: 'admin@example.com',
          username: 'admin',
          name: 'API Admin',
          role: 'ADMIN',
          emailVerified: new Date(),
        },
      });
      
      userId = newUser.id;
      console.log(`✅ Created user: ${newUser.email} (ID: ${userId})`);
    } else {
      // Use the first user found
      const firstUser = await prisma.user.findFirst({
        select: { id: true, email: true, name: true },
      });
      
      userId = firstUser.id;
      console.log(`👤 Using existing user: ${firstUser.email} (ID: ${userId})`);
    }
    
    // Generate API key
    console.log('🔑 Generating API key...');
    const [hashedApiKey, apiKey] = generateUniqueAPIKey();
    const apiKeyPrefix = process.env.API_KEY_PREFIX || 'cal_';
    
    // Create API key in database
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        id: uuidv4(),
        userId: userId,
        hashedKey: hashedApiKey,
        note: 'Generated via script for API access',
        expiresAt: null, // Never expires
      },
    });
    
    const prefixedApiKey = `${apiKeyPrefix}${apiKey}`;
    
    console.log('\n🎉 API Key created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 API Key: ${prefixedApiKey}`);
    console.log(`📝 Note: ${apiKeyRecord.note}`);
    console.log(`⏰ Expires: Never`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📖 Usage:');
    console.log(`curl -H "Authorization: Bearer ${prefixedApiKey}" \\`);
    console.log(`     https://your-render-api-url.onrender.com/api/v2/me`);
    console.log('\n⚠️  IMPORTANT: Save this API key securely - it won\'t be shown again!');
    
  } catch (error) {
    console.error('❌ Error creating API key:', error.message);
    
    if (error.code === 'P2002') {
      console.log('💡 This might be due to a unique constraint violation.');
      console.log('   Try running the script again to generate a different key.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createApiKey().catch(console.error); 