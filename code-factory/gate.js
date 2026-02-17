const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { minimatch } = require('minimatch');

const POLICY_PATH = path.join(__dirname, 'policy.json');
const ROOT_DIR = path.resolve(__dirname, '..');

function loadPolicy() {
  return JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
}

function getChangedFiles() {
  try {
    // Diff against origin/main to see what's in the PR
    // Fallback to HEAD~1 if origin/main isn't reachable (local dev)
    const baseRef = process.env.BASE_REF || 'origin/main';
    const cmd = `git diff --name-only ${baseRef}...HEAD`;
    console.log(`> Checking changes against ${baseRef}...`);
    const output = execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8' });
    return output.trim().split('\n').filter(f => f);
  } catch (e) {
    console.warn('⚠️ Could not determine git diff against base. Checking staged files...');
    const output = execSync('git diff --name-only --cached', { cwd: ROOT_DIR, encoding: 'utf8' });
    return output.trim().split('\n').filter(f => f);
  }
}

function determineRisk(files, policy) {
  let maxRisk = 'default';
  let riskScore = 0;
  const tiers = { 'high': 3, 'medium': 2, 'low': 1, 'default': 0 };
  
  const riskMap = {};

  for (const file of files) {
    let fileRisk = 'default';
    
    // Check High
    if (policy.riskRules.high.some(pattern => minimatch(file, pattern))) {
      fileRisk = 'high';
    } 
    // Check Medium (if not high)
    else if (policy.riskRules.medium.some(pattern => minimatch(file, pattern))) {
      fileRisk = 'medium';
    }
    // Check Low (explicit low rules override default)
    else if (policy.riskRules.low && policy.riskRules.low.some(pattern => minimatch(file, pattern))) {
      fileRisk = 'low';
    }

    riskMap[file] = fileRisk;

    if (tiers[fileRisk] > riskScore) {
      riskScore = tiers[fileRisk];
      maxRisk = fileRisk;
    }
  }

  return { maxRisk, riskMap };
}

function main() {
  console.log('🔒 Running Risk Policy Gate...');
  
  const policy = loadPolicy();
  const files = getChangedFiles();

  if (files.length === 0) {
    console.log('✅ No files changed.');
    return;
  }

  const { maxRisk, riskMap } = determineRisk(files, policy);
  const requirements = policy.mergePolicy[maxRisk] || policy.mergePolicy.default;

  console.log('\n📄 Changed Files & Risk Levels:');
  files.forEach(f => {
    const r = riskMap[f];
    const icon = r === 'high' ? '🔴' : r === 'medium' ? '🟡' : '🟢';
    console.log(` ${icon} ${r.padEnd(7)} : ${f}`);
  });

  console.log('\n📊 Summary:');
  console.log(`  Risk Level: ${maxRisk.toUpperCase()}`);
  console.log(`  Description: ${requirements.description}`);
  console.log('\n🛡️  Required Checks:');
  requirements.requiredChecks.forEach(check => {
    console.log(`  [ ] ${check}`);
  });

  // Output for GitHub Actions (if needed)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `risk_level=${maxRisk}\n`);
  }
}

main();
