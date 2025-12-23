/**
 * Quick check if SolidWorks is available for integration tests
 */

import winax from 'winax';

async function checkSolidWorks() {
  try {
    console.log('🔍 Checking SolidWorks availability...');
    const swApp = new winax.Object('SldWorks.Application') as any;
    swApp.Visible = true;
    
    const version = swApp.RevisionNumber();
    console.log(`✅ SolidWorks is available! Version: ${version}`);
    console.log('📝 You can now run integration tests:');
    console.log('   npm test -- tests/solidworks/helpers/extrusion.integration.test.ts');
    
    return true;
  } catch (error: any) {
    console.log('❌ SolidWorks is not available');
    console.log('   Error:', error.message);
    console.log('   Make sure SolidWorks is installed and can be launched');
    return false;
  }
}

checkSolidWorks().then(available => {
  process.exit(available ? 0 : 1);
});









