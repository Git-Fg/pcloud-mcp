// Generated on 2026-10-19T19:16:18.617Z by pcloud_mcp@1.0.0
// Server: pcloud
// Source: /Users/felix/Documents/pcloud_mcp/config/mcporter.json
// Transport: STDIO sh -c set -a && . /Users/felix/Documents/pcloud_mcp/.env && cd /Users/felix/Documents/pcloud_mcp && exec bun run src/index.ts

import { createRuntime, createServerProxy, wrapCallResult } from 'mcporter';
import type { PcloudTools } from './pcloud-client.d';

type RuntimeInstance = Awaited<ReturnType<typeof createRuntime>>;
export type PcloudClient = PcloudTools & { close(): Promise<void> };

export interface CreateClientOptions {
  runtime?: RuntimeInstance;
  configPath?: string;
  rootDir?: string;
}

export async function createPcloudClient(options: CreateClientOptions = {}): Promise<PcloudClient> {
  const runtime = options.runtime ?? (await createRuntime({
    configPath: options.configPath,
    rootDir: options.rootDir,
  }));
  const ownsRuntime = !options.runtime;
  const proxy = createServerProxy(runtime, "pcloud");
  const client: PcloudClient = {
    async userinfo(params: Parameters<PcloudTools['userinfo']>[0]) {
      const tool = proxy.userinfo as (args: Parameters<PcloudTools['userinfo']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async listfolder(params: Parameters<PcloudTools['listfolder']>[0]) {
      const tool = proxy.listfolder as (args: Parameters<PcloudTools['listfolder']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async stat(params: Parameters<PcloudTools['stat']>[0]) {
      const tool = proxy.stat as (args: Parameters<PcloudTools['stat']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getfilelink(params: Parameters<PcloudTools['getfilelink']>[0]) {
      const tool = proxy.getfilelink as (args: Parameters<PcloudTools['getfilelink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async readfile(params: Parameters<PcloudTools['readfile']>[0]) {
      const tool = proxy.readfile as (args: Parameters<PcloudTools['readfile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async listrevisions(params: Parameters<PcloudTools['listrevisions']>[0]) {
      const tool = proxy.listrevisions as (args: Parameters<PcloudTools['listrevisions']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async createfolder(params: Parameters<PcloudTools['createfolder']>[0]) {
      const tool = proxy.createfolder as (args: Parameters<PcloudTools['createfolder']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async renamefile(params: Parameters<PcloudTools['renamefile']>[0]) {
      const tool = proxy.renamefile as (args: Parameters<PcloudTools['renamefile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async renamefolder(params: Parameters<PcloudTools['renamefolder']>[0]) {
      const tool = proxy.renamefolder as (args: Parameters<PcloudTools['renamefolder']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async uploadfile(params: Parameters<PcloudTools['uploadfile']>[0]) {
      const tool = proxy.uploadfile as (args: Parameters<PcloudTools['uploadfile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async deletefile(params: Parameters<PcloudTools['deletefile']>[0]) {
      const tool = proxy.deletefile as (args: Parameters<PcloudTools['deletefile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async deletefolder(params: Parameters<PcloudTools['deletefolder']>[0]) {
      const tool = proxy.deletefolder as (args: Parameters<PcloudTools['deletefolder']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async resolve(params: Parameters<PcloudTools['resolve']>[0]) {
      const tool = proxy.resolve as (args: Parameters<PcloudTools['resolve']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async trash_list(params: Parameters<PcloudTools['trash_list']>[0]) {
      const tool = proxy.trashList as (args: Parameters<PcloudTools['trash_list']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async trash_restore(params: Parameters<PcloudTools['trash_restore']>[0]) {
      const tool = proxy.trashRestore as (args: Parameters<PcloudTools['trash_restore']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getfilepublink(params: Parameters<PcloudTools['getfilepublink']>[0]) {
      const tool = proxy.getfilepublink as (args: Parameters<PcloudTools['getfilepublink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getfolderpublink(params: Parameters<PcloudTools['getfolderpublink']>[0]) {
      const tool = proxy.getfolderpublink as (args: Parameters<PcloudTools['getfolderpublink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async listpublinks(params: Parameters<PcloudTools['listpublinks']>[0]) {
      const tool = proxy.listpublinks as (args: Parameters<PcloudTools['listpublinks']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async deletepublink(params: Parameters<PcloudTools['deletepublink']>[0]) {
      const tool = proxy.deletepublink as (args: Parameters<PcloudTools['deletepublink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async diff(params: Parameters<PcloudTools['diff']>[0]) {
      const tool = proxy.diff as (args: Parameters<PcloudTools['diff']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async find(params: Parameters<PcloudTools['find']>[0]) {
      const tool = proxy.find as (args: Parameters<PcloudTools['find']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async createuploadlink(params: Parameters<PcloudTools['createuploadlink']>[0]) {
      const tool = proxy.createuploadlink as (args: Parameters<PcloudTools['createuploadlink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async uploadtolink(params: Parameters<PcloudTools['uploadtolink']>[0]) {
      const tool = proxy.uploadtolink as (args: Parameters<PcloudTools['uploadtolink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async showuploadlink(params: Parameters<PcloudTools['showuploadlink']>[0]) {
      const tool = proxy.showuploadlink as (args: Parameters<PcloudTools['showuploadlink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async copyfile(params: Parameters<PcloudTools['copyfile']>[0]) {
      const tool = proxy.copyfile as (args: Parameters<PcloudTools['copyfile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async copyfolder(params: Parameters<PcloudTools['copyfolder']>[0]) {
      const tool = proxy.copyfolder as (args: Parameters<PcloudTools['copyfolder']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async revertrevision(params: Parameters<PcloudTools['revertrevision']>[0]) {
      const tool = proxy.revertrevision as (args: Parameters<PcloudTools['revertrevision']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async createfolderifnotexists(params: Parameters<PcloudTools['createfolderifnotexists']>[0]) {
      const tool = proxy.createfolderifnotexists as (args: Parameters<PcloudTools['createfolderifnotexists']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async downloadfile(params: Parameters<PcloudTools['downloadfile']>[0]) {
      const tool = proxy.downloadfile as (args: Parameters<PcloudTools['downloadfile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async checksumfile(params: Parameters<PcloudTools['checksumfile']>[0]) {
      const tool = proxy.checksumfile as (args: Parameters<PcloudTools['checksumfile']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getthumblink(params: Parameters<PcloudTools['getthumblink']>[0]) {
      const tool = proxy.getthumblink as (args: Parameters<PcloudTools['getthumblink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getvideolink(params: Parameters<PcloudTools['getvideolink']>[0]) {
      const tool = proxy.getvideolink as (args: Parameters<PcloudTools['getvideolink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getaudiolink(params: Parameters<PcloudTools['getaudiolink']>[0]) {
      const tool = proxy.getaudiolink as (args: Parameters<PcloudTools['getaudiolink']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async getapiserver(params: Parameters<PcloudTools['getapiserver']>[0]) {
      const tool = proxy.getapiserver as (args: Parameters<PcloudTools['getapiserver']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async currentserver(params: Parameters<PcloudTools['currentserver']>[0]) {
      const tool = proxy.currentserver as (args: Parameters<PcloudTools['currentserver']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async extractarchive(params: Parameters<PcloudTools['extractarchive']>[0]) {
      const tool = proxy.extractarchive as (args: Parameters<PcloudTools['extractarchive']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async deletefolderrecursive(params: Parameters<PcloudTools['deletefolderrecursive']>[0]) {
      const tool = proxy.deletefolderrecursive as (args: Parameters<PcloudTools['deletefolderrecursive']>[0]) => Promise<unknown>;
      const raw = await tool(params);
      return wrapCallResult(raw).callResult;
    },

    async close() {
      if (ownsRuntime) {
        await runtime.close("pcloud").catch(() => {});
      }
    },
  };
  return client;
}

