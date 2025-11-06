import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Load OpenAPI specification from YAML file
 * Docker: __dirname = /app/src/config, so ../../docs = /app/docs
 * Local: __dirname = project_root/backend/src/config, so ../../../docs = project_root/docs
 */
const openApiYamlPath = join(__dirname, '../../docs/api/openapi.yaml')
const openApiYaml = readFileSync(openApiYamlPath, 'utf8')
export const swaggerSpec = yaml.load(openApiYaml)
