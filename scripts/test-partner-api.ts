/**
 * Test Partner API - Generate test API key and verify it works
 */

import { generatePartnerAPIKey } from '../lib/partner/api-keys';
import { ObjectId } from 'mongodb';

async function main() {
  console.log('🔑 Generating test Partner API key...\n');
  
  // Generate a test API key for a fake partner
  const testPartnerId = new ObjectId().toString();
  
  try {
    const { key, apiKey } = await generatePartnerAPIKey(
      testPartnerId,
      'Test API Key',
      'test',
      'starter'
    );
    
    console.log('✅ API Key generated successfully!\n');
    console.log('Partner ID:', testPartnerId);
    console.log('API Key:', key);
    console.log('\nAPI Key Details:');
    console.log('- Environment:', apiKey.environment);
    console.log('- Tier:', apiKey.tier);
    console.log('- Status:', apiKey.status);
    console.log('- Permissions:', JSON.stringify(apiKey.permissions, null, 2));
    console.log('\n📋 Copy this API key to test in /partner-api-test page:');
    console.log(`\n${key}\n`);
    
    // Test validation
    console.log('🔍 Testing API key validation...');
    const { validateAPIKey } = await import('../lib/partner/api-keys');
    const validated = await validateAPIKey(key);
    
    if (validated) {
      console.log('✅ API key validation successful!');
      console.log('- Has permissions?', validated.permissions && validated.permissions.length > 0);
      console.log('- Permissions:', validated.permissions);
    } else {
      console.log('❌ API key validation failed!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
