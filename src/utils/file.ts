import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { FileType, FileInfo } from '../types/terragrunt.js';

export class FileUtils {
    /**
     * Verifica se um caminho existe
     */
    static async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Lê o conteúdo de um arquivo
     */
    static async readFile(filePath: string): Promise<string> {
        return await fs.readFile(filePath, 'utf-8');
    }

    /**
     * Escreve conteúdo em um arquivo
     */
    static async writeFile(filePath: string, content: string): Promise<void> {
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, content, 'utf-8');
    }

    /**
     * Lista arquivos em um diretório
     */
    static async listFiles(dirPath: string, recursive = false): Promise<string[]> {
        const pattern = recursive ? path.join(dirPath, '**/*') : path.join(dirPath, '*');
        const files = await glob(pattern, { nodir: true });
        return files;
    }

    /**
     * Lista diretórios
     */
    static async listDirectories(dirPath: string, recursive = false): Promise<string[]> {
        const pattern = recursive ? path.join(dirPath, '**/*') : path.join(dirPath, '*');
        try {
            const entries = await glob(pattern);
            const dirs = [];

            for (const entry of entries) {
                try {
                    const stats = await fs.stat(entry);
                    if (stats.isDirectory()) {
                        dirs.push(entry);
                    }
                } catch {
                    // Ignora entradas que não podem ser acessadas
                }
            }

            return dirs;
        } catch {
            return [];
        }
    }

    /**
     * Encontra arquivos Terragrunt
     */
    static async findTerragruntFiles(rootPath: string): Promise<string[]> {
        const patterns = [
            path.join(rootPath, '**/terragrunt.hcl'),
            path.join(rootPath, '**/terragrunt.stack.hcl')
        ];

        const files: string[] = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern);
            files.push(...matches);
        }

        return files;
    }

    /**
     * Encontra arquivos Terraform
     */
    static async findTerraformFiles(rootPath: string): Promise<string[]> {
        const patterns = [
            path.join(rootPath, '**/*.tf'),
            path.join(rootPath, '**/*.tfvars'),
            path.join(rootPath, '**/*.terraform')
        ];

        const files: string[] = [];
        for (const pattern of patterns) {
            const matches = await glob(pattern);
            files.push(...matches);
        }

        return files;
    }

    /**
     * Determina o tipo de arquivo
     */
    static getFileType(filePath: string): FileType {
        const basename = path.basename(filePath).toLowerCase();

        if (basename === 'terragrunt.hcl') {
            return FileType.TERRAGRUNT_HCL;
        }
        if (basename === 'terragrunt.stack.hcl') {
            return FileType.TERRAGRUNT_STACK_HCL;
        }
        if (basename.endsWith('.tf')) {
            return FileType.TERRAFORM_TF;
        }
        if (basename.endsWith('.tfvars')) {
            return FileType.TERRAFORM_TFVARS;
        }
        if (basename === 'readme.md') {
            return FileType.README;
        }

        return FileType.OTHER;
    }

    /**
     * Obtém informações detalhadas de um arquivo
     */
    static async getFileInfo(filePath: string): Promise<FileInfo> {
        const stats = await fs.stat(filePath);

        return {
            path: filePath,
            name: path.basename(filePath),
            type: this.getFileType(filePath),
            size: stats.size,
            lastModified: stats.mtime
        };
    }

    /**
     * Calcula o tamanho total de arquivos
     */
    static async getTotalSize(filePaths: string[]): Promise<number> {
        let totalSize = 0;

        for (const filePath of filePaths) {
            try {
                const stats = await fs.stat(filePath);
                totalSize += stats.size;
            } catch {
                // Ignora arquivos que não podem ser acessados
            }
        }

        return totalSize;
    }

    /**
     * Conta linhas de código em arquivos
     */
    static async countLinesOfCode(filePaths: string[]): Promise<number> {
        let totalLines = 0;

        for (const filePath of filePaths) {
            try {
                const content = await this.readFile(filePath);
                totalLines += content.split('\n').length;
            } catch {
                // Ignora arquivos que não podem ser lidos
            }
        }

        return totalLines;
    }

    /**
     * Verifica se um diretório está vazio
     */
    static async isDirectoryEmpty(dirPath: string): Promise<boolean> {
        try {
            const contents = await fs.readdir(dirPath);
            return contents.length === 0;
        } catch {
            return true;
        }
    }

    /**
     * Cria estrutura de diretórios
     */
    static async ensureDirectory(dirPath: string): Promise<void> {
        await fs.ensureDir(dirPath);
    }

    /**
     * Remove arquivo ou diretório
     */
    static async remove(targetPath: string): Promise<void> {
        await fs.remove(targetPath);
    }

    /**
     * Copia arquivo ou diretório
     */
    static async copy(src: string, dest: string): Promise<void> {
        await fs.copy(src, dest);
    }

    /**
     * Move arquivo ou diretório
     */
    static async move(src: string, dest: string): Promise<void> {
        await fs.move(src, dest);
    }

    /**
     * Obtém caminho relativo
     */
    static getRelativePath(from: string, to: string): string {
        return path.relative(from, to);
    }

    /**
     * Resolve caminho absoluto
     */
    static resolvePath(...paths: string[]): string {
        return path.resolve(...paths);
    }

    /**
     * Junta caminhos
     */
    static joinPath(...paths: string[]): string {
        return path.join(...paths);
    }

    /**
     * Obtém diretório pai
     */
    static getDirectoryName(filePath: string): string {
        return path.dirname(filePath);
    }

    /**
     * Obtém nome base do arquivo
     */
    static getBaseName(filePath: string, ext?: string): string {
        return path.basename(filePath, ext);
    }

    /**
     * Obtém extensão do arquivo
     */
    static getExtension(filePath: string): string {
        return path.extname(filePath);
    }
}
