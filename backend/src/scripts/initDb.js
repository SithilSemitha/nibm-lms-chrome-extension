const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'lms_activities',
  user: process.env.DB_USER || 'lms_user',
  password: process.env.DB_PASSWORD,
});

async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✅ Database initialized successfully!');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - activities');
    console.log('📈 Indexes created');
    console.log('🔍 Views created: activity_stats');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run initialization
initializeDatabase()
  .then(() => {
    console.log('\n✨ Database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Database setup failed:', error);
    process.exit(1);
  });
