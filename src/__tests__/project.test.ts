import { ProjectAnalyzer } from '../analyzers/project';
import { Logger, LogLevel } from '../utils/logger';
import { FileUtils } from '../utils/file';
import path from 'path';

describe('ProjectAnalyzer', () => {
    let analyzer: ProjectAnalyzer;
    let logger: Logger;

    beforeEach(() => {
        logger = new Logger(LogLevel.ERROR); // Silenciar logs durante testes
        analyzer = new ProjectAnalyzer(logger);
    });

    describe('analyzeProject', () => {
        it('should analyze a basic project structure', async () => {
            // Teste com projeto mock
            const mockProjectPath = '/mock/project';

            // Mock do FileUtils para simular estrutura de projeto
            jest.spyOn(FileUtils, 'findTerragruntFiles').mockResolvedValue([
                '/mock/project/terragrunt.hcl',
                '/mock/project/dev/database/terragrunt.hcl'
            ]);

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(`
        terraform {
          source = "../modules/database"
        }
        
        inputs = {
          environment = "dev"
        }
      `);

            jest.spyOn(FileUtils, 'getFileInfo').mockResolvedValue({
                path: '/mock/project/terragrunt.hcl',
                name: 'terragrunt.hcl',
                type: 'terragrunt.hcl' as any,
                size: 1024,
                lastModified: new Date()
            });

            const result = await analyzer.analyzeProject(mockProjectPath, {
                includeMetrics: false,
                includeValidation: false,
                includeDependencies: false
            });

            expect(result).toHaveProperty('terragruntVersion');
            expect(result).toHaveProperty('structure');
            expect(result).toHaveProperty('configFiles');
            expect(result).toHaveProperty('modules');
            expect(result.configFiles).toHaveLength(2);
        });

        it('should handle empty projects', async () => {
            const mockProjectPath = '/empty/project';

            jest.spyOn(FileUtils, 'findTerragruntFiles').mockResolvedValue([]);
            jest.spyOn(FileUtils, 'listDirectories').mockResolvedValue([]);
            jest.spyOn(FileUtils, 'listFiles').mockResolvedValue([]);

            const result = await analyzer.analyzeProject(mockProjectPath);

            expect(result.configFiles).toHaveLength(0);
            expect(result.modules).toHaveLength(0);
            expect(result.stacks).toHaveLength(0);
        });
    });

    describe('parseConfig', () => {
        it('should parse terraform block correctly', async () => {
            const configContent = `
        terraform {
          source = "git::https://github.com/org/modules.git//database?ref=v1.0.0"
        }
        
        inputs = {
          database_name = "myapp"
          instance_class = "db.t3.micro"
        }
      `;

            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(configContent);

            const config = await (analyzer as any).parseConfig('/mock/terragrunt.hcl');

            expect(config.terraform).toBeDefined();
            expect(config.terraform.source).toBe('git::https://github.com/org/modules.git//database?ref=v1.0.0');
        });

        it('should handle malformed HCL gracefully', async () => {
            const malformedContent = `
        terraform {
          source = "incomplete
        }
      `;

            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(malformedContent);

            const config = await (analyzer as any).parseConfig('/mock/terragrunt.hcl');

            // Deve retornar objeto vazio ou com estrutura básica
            expect(config).toBeDefined();
        });
    });

    describe('extractDependencies', () => {
        it('should extract dependencies from various blocks', () => {
            const config = {
                dependencies: {
                    paths: ['../vpc', '../security-group']
                },
                dependency: {
                    vpc: {
                        config_path: '../vpc'
                    },
                    sg: {
                        config_path: '../security-group'
                    }
                }
            };

            const dependencies = (analyzer as any).extractDependencies(config);

            expect(dependencies).toContain('../vpc');
            expect(dependencies).toContain('../security-group');
            expect(dependencies.length).toBeGreaterThan(0);
        });

        it('should handle empty dependencies', () => {
            const config = {};

            const dependencies = (analyzer as any).extractDependencies(config);

            expect(dependencies).toEqual([]);
        });
    });

    describe('detectTerragruntVersion', () => {
        it('should detect version from .terragrunt-version file', async () => {
            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue('0.82.3\n');

            const version = await analyzer.detectTerragruntVersion('/mock/project');

            expect(version).toBe('0.82.3');
        });

        it('should default to 0.82.3 when no version file exists', async () => {
            jest.spyOn(FileUtils, 'exists').mockResolvedValue(false);

            const version = await analyzer.detectTerragruntVersion('/mock/project');

            expect(version).toBe('0.82.3');
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});
