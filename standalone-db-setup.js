const { Client } = require('pg');
const { randomBytes, createHash } = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Hash the API key (same as cal.com does)
const hashAPIKey = (apiKey) => createHash('sha256').update(apiKey).digest('hex');

// Generate a unique API key (same as cal.com does)
const generateUniqueAPIKey = (apiKey = randomBytes(16).toString('hex')) => [
  hashAPIKey(apiKey),
  apiKey,
];

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Set it to your Render PostgreSQL connection string');
  process.exit(1);
}

async function setupDatabase() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Create users table if it doesn't exist
    console.log('📊 Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create api_keys table if it doesn't exist
    console.log('🔑 Creating api_keys table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ApiKey" (
        id VARCHAR(255) PRIMARY KEY,
        "userId" INTEGER NOT NULL,
        note VARCHAR(255),
        "hashedKey" VARCHAR(255) UNIQUE NOT NULL,
        "expiresAt" TIMESTAMP,
        "lastUsedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Check if user exists
    console.log('👤 Checking for existing users...');
    const userResult = await client.query('SELECT * FROM users LIMIT 1');
    
    let userId;
    if (userResult.rows.length === 0) {
      console.log('👤 Creating admin user...');
      const insertUserResult = await client.query(`
        INSERT INTO users (email, name) 
        VALUES ($1, $2) 
        RETURNING id
      `, ['admin@cal.com', 'Admin User']);
      userId = insertUserResult.rows[0].id;
      console.log('✅ Admin user created with ID:', userId);
    } else {
      userId = userResult.rows[0].id;
      console.log('✅ Using existing user with ID:', userId);
    }

    // Generate API key
    console.log('🔑 Generating API key...');
    const [hashedKey, plainKey] = generateUniqueAPIKey();
    const keyId = uuidv4();
    
    await client.query(`
      INSERT INTO "ApiKey" (id, "userId", note, "hashedKey") 
      VALUES ($1, $2, $3, $4)
    `, [keyId, userId, 'Generated API Key', hashedKey]);

    console.log('');
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('📋 Your API Key Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔑 API Key: cal_${plainKey}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🆔 Key ID: ${keyId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('1. Add this DATABASE_URL to your Render service environment variables');
    console.log('2. Test your API with:');
    console.log(`   curl -H "Authorization: Bearer cal_${plainKey}" https://calcom-api.onrender.com/api/v2/me`);
    console.log('');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase(); 