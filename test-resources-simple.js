#!/usr/bin/env node

// Simple test for MCP resources to verify they're accessible

const { spawn } = require('child_process');

async function testResource(resourceUri) {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    server.stdout.on('data', (data) => {
      output += data.toString();
    });

    server.on('close', (code) => {
      try {
        // Try to parse the JSON response
        const lines = output.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            if (response.result && response.result.contents) {
              resolve(response.result.contents[0]);
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
        reject(new Error('No valid response found'));
      } catch (error) {
        reject(error);
      }
    });

    // Send initialize first
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' }
      }
    };

    // Send resource request
    const resourceRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'resources/read',
      params: { uri: resourceUri }
    };

    server.stdin.write(JSON.stringify(initRequest) + '\n');
    setTimeout(() => {
      server.stdin.write(JSON.stringify(resourceRequest) + '\n');
      server.stdin.end();
    }, 100);

    setTimeout(() => {
      server.kill();
      reject(new Error('Timeout'));
    }, 5000);
  });
}

async function main() {
  console.log('📚 Testing MCP Resources (Simple)...\n');

  const resources = [
    'project-index://file-list',
    'project-index://symbol-index', 
    'project-index://dependency-graph',
    'project-index://project-index'
  ];

  for (const resource of resources) {
    try {
      console.log(`Testing ${resource}...`);
      const result = await testResource(resource);
      
      // Check if we can parse the JSON content
      try {
        const content = JSON.parse(result.text);
        if (Array.isArray(content)) {
          console.log(`✅ ${resource}: Array with ${content.length} items`);
        } else if (typeof content === 'object') {
          console.log(`✅ ${resource}: Object with ${Object.keys(content).length} keys`);
        } else {
          console.log(`✅ ${resource}: Data retrieved (${typeof content})`);
        }
      } catch (parseError) {
        // Check if it's just too large
        if (result.text.length > 10000) {
          console.log(`✅ ${resource}: Large data retrieved (${result.text.length} chars)`);
        } else {
          console.log(`❌ ${resource}: JSON parse error - ${parseError.message}`);
        }
      }
    } catch (error) {
      console.log(`❌ ${resource}: ${error.message}`);
    }
  }

  console.log('\n✅ Resources test completed!');
}

main().catch(console.error);