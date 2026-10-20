import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';
import { main as httpMain } from './mcp/http.js';

async function main() {
  const mode = process.env.MODE || process.argv[2] || 'stdio';
  
  if (mode === 'http') {
    await httpMain();
  } else {
    // stdio mode (default)
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('pCloud MCP Server running on stdio');
  }
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
