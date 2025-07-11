import { ConfigAnalyzer } from '../analyzers/config';
import { Logger, LogLevel } from '../utils/logger';
import { FileUtils } from '../utils/file';

describe('ConfigAnalyzer', () => {
    let analyzer: ConfigAnalyzer;
    let logger: Logger;

    beforeEach(() => {
        logger = new Logger(LogLevel.ERROR);
        analyzer = new ConfigAnalyzer(logger);
    });

    describe('validateConfig', () => {
        it('should validate a correct terragrunt.hcl file', async () => {
            const validConfig = `
        terraform {
          source = "../modules/database"
        }

        remote_state {
          backend = "s3"
          config = {
            bucket = "my-terraform-state"
            key    = "database/terraform.tfstate"
            region = "us-east-1"
          }
        }

        inputs = {
          database_name = "myapp"
        }
      `;

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(validConfig);
            jest.spyOn(FileUtils, 'getBaseName').mockReturnValue('terragrunt.hcl');

            const result = await analyzer.validateConfig('/mock/terragrunt.hcl');

            expect(result.isValid).toBe(true);
            expect(result.configType).toBe('terragrunt.hcl');
            expect(result.errors).toHaveLength(0);
            expect(result.blocks).toContain('terraform');
            expect(result.blocks).toContain('remote_state');
        });

        it('should detect errors in malformed config', async () => {
            const invalidConfig = `
        terraform {
          # Missing source
        }

        remote_state {
          # Missing backend and config
        }
      `;

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(invalidConfig);
            jest.spyOn(FileUtils, 'getBaseName').mockReturnValue('terragrunt.hcl');

            const result = await analyzer.validateConfig('/mock/terragrunt.hcl');

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.message.includes('source'))).toBe(true);
        });

        it('should validate terragrunt.stack.hcl files', async () => {
            const stackConfig = `
        unit "database" {
          source = "catalog://database:v1.0.0"

          inputs = {
            instance_class = "db.t3.micro"
          }
        }

        unit "web" {
          source = "catalog://web:v1.0.0"

          dependencies = ["database"]

          inputs = {
            database_endpoint = dependency.database.outputs.endpoint
          }
        }
      `;

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(stackConfig);
            jest.spyOn(FileUtils, 'getBaseName').mockReturnValue('terragrunt.stack.hcl');

            const result = await analyzer.validateConfig('/mock/terragrunt.stack.hcl');

            expect(result.configType).toBe('terragrunt.stack.hcl');
            expect(result.blocks).toContain('unit');
        });

        it('should apply strict mode validations', async () => {
            const configWithExperimental = `
        terraform {
          source = "../modules/test"
        }

        engine {
          type = "experimental"
        }
      `;

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(configWithExperimental);
            jest.spyOn(FileUtils, 'getBaseName').mockReturnValue('terragrunt.hcl');

            const result = await analyzer.validateConfig('/mock/terragrunt.hcl', {
                strictMode: true
            });

            expect(result.warnings.some(w => w.message.includes('experimentais'))).toBe(true);
        });

        it('should handle non-existent files', async () => {
            jest.spyOn(FileUtils, 'exists').mockResolvedValue(false);

            await expect(analyzer.validateConfig('/nonexistent/file.hcl'))
                .rejects.toThrow('Arquivo de configuração não encontrado');
        });
    });

    describe('syntax validation', () => {
        it('should detect unbalanced braces', async () => {
            const unbalancedConfig = `
        terraform {
          source = "../modules/test"
        # Missing closing brace
      `;

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(unbalancedConfig);
            jest.spyOn(FileUtils, 'getBaseName').mockReturnValue('terragrunt.hcl');

            const result = await analyzer.validateConfig('/mock/terragrunt.hcl');

            expect(result.errors.some(e => e.message.includes('Chaves desbalanceadas'))).toBe(true);
        });

        it('should detect unclosed quotes', async () => {
            const unclosedQuotes = `
        terraform {
          source = "../modules/test
        }
      `;

            jest.spyOn(FileUtils, 'exists').mockResolvedValue(true);
            jest.spyOn(FileUtils, 'readFile').mockResolvedValue(unclosedQuotes);
            jest.spyOn(FileUtils, 'getBaseName').mockReturnValue('terragrunt.hcl');

            const result = await analyzer.validateConfig('/mock/terragrunt.hcl');

            expect(result.warnings.some(w => w.message.includes('aspas'))).toBe(true);
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });
});
