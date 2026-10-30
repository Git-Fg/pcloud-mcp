import { describe, it, expect } from 'bun:test';

process.env.PCLOUD_ACCESS_TOKEN = 'unit-test-token';

interface Captured {
  name: string;
  config: { title?: string; description?: string; argsSchema?: unknown };
  callback: (args: Record<string, unknown>) => {
    messages: Array<{ role: string; content: { type: string; text: string } }>;
  };
}

/** A server that records what was registered, so the prompts can be read back. */
async function registered(): Promise<Captured[]> {
  const { registerPcloudPrompts } = await import('./prompts.js');
  const captured: Captured[] = [];
  const fake = {
    registerPrompt(
      name: string,
      config: Captured['config'],
      callback: Captured['callback']
    ) {
      captured.push({ name, config, callback });
    },
  };
  registerPcloudPrompts(fake as never);
  return captured;
}

describe('pCloud prompts', () => {
  it('registers the curation workflows', async () => {
    const names = (await registered()).map((p) => p.name);
    expect(names).toContain('audit_duplicates');
    expect(names).toContain('classify_corpus');
    expect(names).toContain('rename_from_content');
    expect(names).toContain('curation_report');
    expect(names).toContain('summarize_tree');
    expect(names).toContain('verify_upload');
    expect(names).toContain('audit_public_links');
    expect(names).toContain('recover_from_trash');
    expect(names).toContain('search_contents');
    expect(names).toContain('taxonomy_drift_check');
  });

  it('gives every prompt a title and a description', async () => {
    for (const prompt of await registered()) {
      expect(prompt.config.title).toBeTruthy();
      expect(prompt.config.description).toBeTruthy();
    }
  });

  it('names the tools the workflow uses, so the agent can chain them', async () => {
    const prompts = await registered();
    const audit = prompts.find((p) => p.name === 'audit_duplicates')!;
    const text = audit.callback({ folderid: 0, minSize: 1024 }).messages[0].content.text;

    expect(text).toContain('list_recursive');
    expect(text).toContain('checksum_group');
    expect(text).toContain('1024');
  });

  it('states the pCloud limitation the trash family has, instead of retrying it', async () => {
    const prompts = await registered();
    const recover = prompts.find((p) => p.name === 'recover_from_trash')!;
    const text = recover.callback({ folderid: 0 }).messages[0].content.text;

    expect(text).toContain('1000');
    expect(text).toContain('trash_list');
  });

  it('offers a choice instead of prescribing one action', async () => {
    const prompts = await registered();
    const audit = prompts.find((p) => p.name === 'audit_duplicates')!;
    const text = audit.callback({ folderid: 0 }).messages[0].content.text;

    expect(text).toMatch(/offer the choices|ask before/i);
  });

  it('keeps every prompt body within a size an agent can hold in mind', async () => {
    for (const prompt of await registered()) {
      const text = prompt.callback({ folderid: 0 }).messages[0].content.text;
      expect(text.length).toBeGreaterThan(100);
      expect(text.length).toBeLessThan(4000);
    }
  });
});
