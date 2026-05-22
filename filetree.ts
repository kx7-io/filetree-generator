#!/usr/bin/env node

/**
 * FileTree Generator – Modo automático via arquivo de estrutura
 *
 * Uso:  npx tsx filetree.ts [arquivo.txt]
 *   - Se arquivo for omitido, procura "estrutura.txt" no diretório atual.
 *   - O arquivo pode começar com "#base:documents" (ou downloads/desktop).
 *   - Cria toda a estrutura dentro do diretório base automaticamente.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { existsSync } from 'fs';

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------
interface TreeItem {
  name: string;
  type: 'directory' | 'file';
  level: number;
}

interface TreeItemWithPath extends TreeItem {
  fullPath: string;
  relativePath: string;
}

// ------------------------------------------------------------
// Motor
// ------------------------------------------------------------
class FileTreeEngine {
  // Mapeamento de bases conhecidas
  private standardDirs: Record<string, string>;

  constructor() {
    this.standardDirs = {
      documents: this.findDir(['Documentos', 'Documents', 'documentos', 'docs', 'Arquivos', 'Files']),
      downloads: this.findDir(['Downloads', 'downloads', 'Transferências', 'Descargas']),
      desktop: this.findDir(['Desktop', 'Área de Trabalho', 'Escritorio'])
    };
  }

  private findDir(candidates: string[]): string {
    const home = os.homedir();
    for (const name of candidates) {
      const dir = path.join(home, name);
      if (existsSync(dir)) return dir;
    }
    // Fallback: cria o primeiro candidato
    const fallback = path.join(home, candidates[0]);
    fs.mkdir(fallback, { recursive: true }).catch(() => {});
    return fallback;
  }

  resolveBaseDir(input: string): string {
    const key = input.toLowerCase().trim();
    return this.standardDirs[key] || this.standardDirs.documents;
  }

  // ----------------------------------------------------------
  // PARSER (nível por posição do ├/└ e limpeza total)
  // ----------------------------------------------------------
  parseTreeLayout(layout: string): TreeItem[] {
    const lines = layout.split('\n').filter(l => l.trim());
    const structure: TreeItem[] = [];

    for (const line of lines) {
      const level = this.calcLevel(line);
      const cleanName = line.replace(/^[\s│├└─]+/, '').trim();
      if (!cleanName) continue;

      const isDir = cleanName.endsWith('/');
      let name = isDir ? cleanName.slice(0, -1).trim() : cleanName.trim();

      if (!isDir) {
        name = this.cleanFileName(name);
      }

      if (name) {
        structure.push({ name, type: isDir ? 'directory' : 'file', level });
      }
    }
    return structure;
  }

  private calcLevel(line: string): number {
    const idx = Math.min(
      line.indexOf('├') !== -1 ? line.indexOf('├') : Infinity,
      line.indexOf('└') !== -1 ? line.indexOf('└') : Infinity
    );
    return idx === Infinity ? 0 : Math.floor(idx / 4) + 1;
  }

  private cleanFileName(name: string): string {
    // Mantém nome + primeira extensão, remove lixo
    const dotIdx = name.indexOf('.');
    if (dotIdx !== -1) {
      const base = name.substring(0, dotIdx).trim();
      const rest = name.substring(dotIdx + 1);
      const ext = rest.split(/\s+/)[0].trim();
      return `${base}.${ext}`;
    }
    return name.replace(/\s+/g, ' ').trim();
  }

  // ----------------------------------------------------------
  // Garantia de raiz "yeto-gateway" (se não existir)
  // ----------------------------------------------------------
  enforceRoot(structure: TreeItem[]): TreeItem[] {
    if (structure.length === 0) {
      return [{ name: 'yeto-gateway', type: 'directory', level: 0 }];
    }
    const first = structure[0];
    if (first.type === 'directory' && first.level === 0) {
      return structure; // já tem raiz
    }
    // Insere raiz padrão e ajusta níveis
    return [
      { name: 'yeto-gateway', type: 'directory', level: 0 },
      ...structure.map(item => ({ ...item, level: item.level + 1 }))
    ];
  }

  // ----------------------------------------------------------
  // Montagem dos caminhos absolutos
  // ----------------------------------------------------------
  buildPaths(structure: TreeItem[], baseDir: string): TreeItemWithPath[] {
    const paths: TreeItemWithPath[] = [];
    const stack: { level: number; relPath: string }[] = [];

    for (const item of structure) {
      while (stack.length && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }
      const parentRel = stack.length ? stack[stack.length - 1].relPath : '';
      const relPath = parentRel ? `${parentRel}/${item.name}` : item.name;
      const fullPath = path.join(baseDir, relPath);

      paths.push({ ...item, relativePath: relPath, fullPath });

      if (item.type === 'directory') {
        stack.push({ level: item.level, relPath });
      }
    }
    return paths;
  }

  // ----------------------------------------------------------
  // Segurança e criação
  // ----------------------------------------------------------
  validate(fullPath: string, baseDir: string): void {
    const absTarget = path.resolve(fullPath);
    const absBase = path.resolve(baseDir);
    if (!absTarget.startsWith(absBase)) {
      throw new Error(`Travessia de diretório: ${fullPath}`);
    }
  }

  async mkdir(dirPath: string): Promise<boolean> {
    try {
      await fs.mkdir(dirPath, { recursive: true, mode: 0o755 });
      return true;
    } catch (err: any) {
      if (err.code === 'EEXIST') return false;
      throw err;
    }
  }

  async mkfile(filePath: string): Promise<boolean> {
    try {
      await this.mkdir(path.dirname(filePath));
      const handle = await fs.open(filePath, 'wx');
      await handle.close();
      return true;
    } catch (err: any) {
      if (err.code === 'EEXIST') return false;
      throw err;
    }
  }
}

// ------------------------------------------------------------
// Leitura do arquivo de estrutura (com cabeçalho opcional)
// ------------------------------------------------------------
async function readStructureFile(filePath: string): Promise<{ base: string; tree: string }> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  let base = 'documents';
  let start = 0;

  if (lines.length > 0 && lines[0].startsWith('#base:')) {
    const val = lines[0].slice(6).trim().toLowerCase();
    if (['documents', 'downloads', 'desktop'].includes(val)) {
      base = val;
    }
    start = 1;
  }

  // Pula linhas vazias iniciais
  while (start < lines.length && lines[start].trim() === '') {
    start++;
  }

  const tree = lines.slice(start).join('\n').trim();
  if (!tree) {
    throw new Error('Arquivo de estrutura vazio.');
  }
  return { base, tree };
}

// ------------------------------------------------------------
// MAIN
// ------------------------------------------------------------
async function main() {
  const engine = new FileTreeEngine();

  // Determina o arquivo de estrutura
  let structFile = process.argv[2];
  if (!structFile) {
    // Procura por 'estrutura.txt' no diretório atual
    const defaultPath = path.join(process.cwd(), 'estrutura.txt');
    if (existsSync(defaultPath)) {
      structFile = defaultPath;
    } else {
      console.error('❌ Nenhum arquivo informado e "estrutura.txt" não encontrado no diretório atual.');
      console.error('   Uso: npx tsx filetree.ts [arquivo.txt]');
      console.error('   Crie um arquivo "estrutura.txt" com a árvore desejada.');
      process.exit(1);
    }
  }

  console.log(`📄 Lendo estrutura de: ${structFile}`);
  const { base, tree } = await readStructureFile(structFile);
  const baseDir = engine.resolveBaseDir(base);
  console.log(`📂 Base: ${base} → ${baseDir}`);

  // Processamento
  const rawItems = engine.parseTreeLayout(tree);
  const withRoot = engine.enforceRoot(rawItems);
  const fullPaths = engine.buildPaths(withRoot, baseDir);

  // Exibição
  console.log('\n📋 Estrutura que será criada:');
  console.log('─'.repeat(50));
  fullPaths.forEach(item => {
    const icon = item.type === 'directory' ? '📁' : '📄';
    const indent = '  '.repeat(item.level);
    console.log(`${indent}${icon} ${item.relativePath}`);
  });
  console.log('─'.repeat(50));

  // Criação (sem confirmação)
  console.log('🔧 Criando (modo automático)...');
  let created = 0, skipped = 0, errors = 0;

  for (const item of fullPaths) {
    try {
      engine.validate(item.fullPath, baseDir);
      const isNew = item.type === 'directory'
        ? await engine.mkdir(item.fullPath)
        : await engine.mkfile(item.fullPath);
      isNew ? created++ : skipped++;
    } catch (err: any) {
      console.error(`❌ ${item.relativePath}: ${err.message}`);
      errors++;
    }
  }

  // Relatório
  console.log('\n📊 RESULTADO:');
  console.log('═'.repeat(50));
  console.log(`✅ Criados agora:  ${created}`);
  console.log(`⏭️  Já existiam:    ${skipped}`);
  console.log(`❌ Erros:         ${errors}`);

  if (created > 0) {
    console.log('\n📁 Primeiros itens criados:');
    fullPaths.filter(i => i.type === 'directory').slice(0, 5).forEach(i => {
      console.log(`  📁 ${i.relativePath}`);
    });
  }

  // Verificação final
  const rootPath = path.join(baseDir, 'yeto-gateway');
  try {
    await fs.stat(rootPath);
    console.log(`\n✅ Raiz confirmada em: ${rootPath}`);
  } catch {
    console.log('\n⚠️  Não foi possível confirmar a criação da raiz.');
  }
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
