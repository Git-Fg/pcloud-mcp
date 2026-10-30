/**
 * A view over the pCloud inventory the cleanup scripts work from.
 *
 * The inventory is a tree of folders and files. The scripts ask the same
 * three questions of it: which folders exist, what file sits where, and
 * what name is already taken in a given folder. The last one matters most:
 * pCloud replaces the file that sits under the target name, so a move has
 * to know what the destination already holds.
 */

export interface InventoryNode {
  name: string;
  path: string;
  isfolder: boolean;
  folderid?: number;
  fileid?: number;
  size?: number;
  children?: InventoryNode[];
}

export interface InventoryIndex {
  folders: InventoryNode[];
  files: InventoryNode[];
  /** The identifier of every folder, by its path. */
  idByPath: Map<string, number>;
  /** The names every folder already holds, by the folder's path. */
  namesByFolder: Map<string, Set<string>>;
}

export function indexInventory(roots: InventoryNode[]): InventoryIndex {
  const folders: InventoryNode[] = [];
  const files: InventoryNode[] = [];
  const idByPath = new Map<string, number>();
  const namesByFolder = new Map<string, Set<string>>();

  (function walk(list: InventoryNode[], parentPath: string | null): void {
    for (const node of list) {
      if (parentPath !== null) {
        const names = namesByFolder.get(parentPath) ?? new Set<string>();
        names.add(node.name);
        namesByFolder.set(parentPath, names);
      }
      if (node.isfolder) {
        folders.push(node);
        if (node.folderid !== undefined) idByPath.set(node.path, node.folderid);
        walk(node.children ?? [], node.path);
      } else {
        files.push(node);
      }
    }
  })(roots, null);

  return { folders, files, idByPath, namesByFolder };
}

/**
 * Tracks the names a folder holds, including the ones claimed during the
 * run, so two files planned for the same destination never take the same
 * name.
 */
export class NameBook {
  private readonly claimed = new Map<string, Set<string>>();

  constructor(private readonly index: InventoryIndex) {}

  /** The names the folder already holds. */
  names(folderPath: string): Set<string> {
    const existing = this.index.namesByFolder.get(folderPath) ?? new Set<string>();
    const extra = this.claimed.get(folderPath);
    if (!extra) return new Set(existing);
    return new Set([...existing, ...extra]);
  }

  /** A free name for the folder, and the claim on it. */
  claim(folderPath: string, wanted: string, free: (taken: ReadonlySet<string>, wanted: string) => string): string {
    const taken = this.names(folderPath);
    const chosen = free(taken, wanted);
    const claims = this.claimed.get(folderPath) ?? new Set<string>();
    claims.add(chosen);
    this.claimed.set(folderPath, claims);
    return chosen;
  }
}
