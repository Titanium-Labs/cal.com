const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.log('Set it to your Render PostgreSQL connection string');
  process.exit(1);
}

async function setupDatabase() {
  try {
    console.log('🗄️  Setting up Cal.com database...');
    
    // Step 1: Run Prisma migrations
    console.log('📊 Running database migrations...');
    await execAsync('yarn prisma migrate deploy');
    console.log('✅ Migrations completed');
    
    // Step 2: Generate Prisma client
    console.log('🔧 Generating Prisma client...');
    await execAsync('yarn prisma generate');
    console.log('✅ Prisma client generated');
    
    // Step 3: Create API key
    console.log('🔑 Creating API key...');
    require('./create-api-key.js');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    
    if (error.message.includes('migrate')) {
      console.log('💡 Make sure your DATABASE_URL is correct and the database is accessible');
    }
  }
}

setupDatabase().catch(console.error); 