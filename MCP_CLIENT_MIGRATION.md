# MCP Client Generator Migration Plan

## Current Issues with Mcporter 0.7.3

After thorough analysis of the pCloud MCP implementation, two critical issues were identified with the mcporter-generated TypeScript client:

### 1. Strict TypeScript Compatibility Issues
- Generated `.d.ts` files have function signatures expecting positional arguments
- Actual client implementation uses proxy pattern that passes objects
- This creates type-checking failures under strict TypeScript configurations
- Example: `userinfo(): Promise<object>` vs actual implementation requiring `{}` parameter

### 2. Runtime Failures for No-Argument Tools
- Tools with zero parameters fail at runtime
- Root cause: Proxy expects empty object argument but some tool handlers don't properly handle this case
- Error manifests as "Invalid arguments" or similar MCP protocol errors

## Recommended Migration Approach

### Replace Mcporter-Generated Clients with Direct SDK Clients

Instead of relying on mcporter for client generation, we recommend implementing typed clients directly using the `@modelcontextprotocol/sdk`. This approach offers:

1. **Full Type Control**: Direct ownership of type definitions eliminates mismatches
2. **Reduced Dependencies**: Remove mcporter build-time dependency
3. **Better Debugging**: Clearer stack traces and behavior
4. **Official SDK Alignment**: Uses the same library as the server implementation

## Migration Steps

### Phase 1: Dependency Updates

1. Remove mcporter from devDependencies:
   ```bash
   bun remove mcporter
   ```

2. Keep @modelcontextprotocol/sdk (already in dependencies)

### Phase 2: Implement Direct Typed Client

Create a new client implementation in `src/client/pcloud-client.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  CallToolResult,
  ListToolsResult,
  MCPServerInfo,
  Prompt,
  Resource,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';

// Import generated types from server schemas
import type { 
  PcloudTools as ToolDefinitions,
  PcloudToolDefinitions 
} from './generated/pcloud-schema-types.ts'; // To be created

export class PcloudClient {
  private client: Client;
  private transport: StdioClientTransport;
  
  constructor() {
    this.transport = new StdioClientTransport({
      command: 'sh',
      args: ['-c', 'set -a && . ./.env && cd ./ && exec bun run src/index.ts']
    });
    
    this.client = new Client(
      {
        name: 'pcloud-client',
        version: '1.0.0'
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {}
        }
      }
    );
  }
  
  async connect(): Promise<void> {
    await this.client.connect(this.transport);
  }
  
  async disconnect(): Promise<void> {
    await this.client.close();
    await this.transport.close();
  }
  
  // Example tool implementation - repeat for all 37 tools
  async userinfo(): Promise<any> {
    const result = await this.client.callTool<CallToolResult>({
      name: 'userinfo',
      arguments: {}
    });
    
    if (result.isError) {
      throw new Error(result.error.message);
    }
    
    // Extract and return the actual result based on content type
    for (const content of result.content) {
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
    }
    
    throw new Error('Unexpected response format');
  }
  
  // Implement all other tools similarly...
}

// Factory function for ease of use
export async function createPcloudClient(): Promise<PcloudClient> {
  const client = new PcloudClient();
  await client.connect();
  return client;
}
```

### Phase 3: Generate Schema Types (Optional)

Instead of mcporter's approach, we can:

1. Extract Zod schemas from server tool definitions
2. Generate TypeScript interfaces directly from these schemas
3. Or manually maintain the type definitions (preferred for stability)

### Phase 4: Update Build Process

Modify build scripts to:
1. Generate schema types from server definitions (optional)
2. Compile the new client implementation
3. Bundle for distribution if needed

### Phase 5: Testing

1. Verify all 37 tools work correctly with strict TypeScript
2. Test both STDIO and HTTP transports
3. Ensure backward compatibility with existing CLI usage
4. Validate error handling matches original behavior

## Alternative Approaches Considered

### 1. Fix Mcporter Itself
- **Pros**: Minimal changes to existing workflow
- **Cons**: Dependent on upstream fixes, may not resolve all issues
- **Verdict**: Not recommended as it doesn't address fundamental architectural concerns

### 2. Use OpenAPI-to-MCP Patterns
- **Pros**: Leverages existing OpenAPI tooling
- **Cons**: pCloud API isn't OpenAPI-first, adds translation layer
- **Verdict**: Over-engineering for this use case

### 3. Hand-Write Clients Without Types
- **Pros**: Simple implementation
- **Cons**: Loses type safety, defeats purpose of typed client
- **Verdict**: Not recommended

## Benefits of Direct SDK Approach

1. **Eliminates TypeScript Mismatches**: Direct control over signatures
2. **Removes Proxy Layer Bugs**: No more issues with argument passing
3. **Better Performance**: Reduced abstraction layers
4. **Clearer Debugging**: Direct access to SDK error messages
5. **Future-Proof**: Aligns with MCP ecosystem evolution
6. **Reduced Build Complexity**: Fewer dependencies, simpler CI/CD

## File Changes Summary

### Remove:
- `config/mcporter.json` (if only used for client generation)
- Mcporter references in package.json devDependencies
- Generated client files (`generated/pcloud-client.*`)

### Add:
- New `src/client/pcloud-client.ts` with direct SDK implementation
- Optional: Schema generation scripts/tools
- Updated build/test instructions in README

### Update:
- Documentation to reflect new client usage patterns
- Examples in README showing client usage
- Any internal usage of generated client

## Verification Checklist

- [ ] All 37 tools type-check under strict TypeScript
- [ ] All 37 tools execute successfully via both STDIO and HTTP
- [ ] Error handling matches original behavior
- [ ] CLI (`pcloud-cli.js`) continues to work unchanged
- [ ] MCP server (`pcloud.ts`) continues to work unchanged
- [ ] Bundle size remains reasonable
- [ ] No regressions in existing functionality

## Risks and Mitigations

### Risk: Inconsistent behavior between implementations
**Mitigation**: Comprehensive test suite comparing outputs

### Risk: Missing edge cases in manual implementation
**Mitigation**: Start with most-used tools, expand gradually

### Risk: Build process complexity
**Mitigation**: Keep implementation simple, use bun's built-in capabilities

## Conclusion

The direct `@modelcontextprotocol/sdk`-based approach provides the cleanest path forward, eliminating the core issues with mcporter while maintaining full compatibility with the existing MCP server and CLI. This approach aligns with MCP best practices and provides a solid foundation for future enhancements.