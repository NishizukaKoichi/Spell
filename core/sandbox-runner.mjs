#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

async function main() {
  const rawArgs = process.argv.slice(2)
  const positional = []
  const options = {}
  while (rawArgs.length > 0) {
    const arg = rawArgs.shift()
    if (arg === '--') {
      positional.push(...rawArgs)
      break
    }
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=', 2)
      options[key] = value ?? true
      continue
    }
    positional.push(arg)
  }

  const [inputPath, outputDir] = positional
  if (!inputPath || !outputDir) {
    console.error('Usage: sandbox-runner [--flag] <input.json> <output_dir>')
    process.exit(1)
  }

  await mkdir(outputDir, { recursive: true })

  let input = {}
  try {
    const raw = await readFile(inputPath, 'utf8')
    input = JSON.parse(raw)
  } catch (err) {
    console.warn('sandbox-runner: failed to parse input, using empty payload', err)
  }

  const now = new Date().toISOString()
  const runId = process.env.SPELL_RUN_ID || input.run_id || 'local-run'
  const tenantId = process.env.SPELL_TENANT_ID || input.tenant_id || 'local-tenant'
  const spellId = process.env.SPELL_ID || input.spell_id || 'local-spell'

  const result = {
    run_id: runId,
    tenant_id: tenantId,
    spell_id: spellId,
    status: 'succeeded',
    finished_at: now,
    input,
    output: {
      message: `Spell ${spellId} completed for tenant ${tenantId}`,
      generated_at: now,
    },
    sandbox_options: options,
  }

  const logs = [
    {
      level: 'info',
      message: 'sandbox.start',
      at: now,
      run_id: runId,
      spell_id: spellId,
      tenant_id: tenantId,
    },
    {
      level: 'info',
      message: 'sandbox.input',
      at: now,
      run_id: runId,
      spell_id: spellId,
      tenant_id: tenantId,
      fields: Object.keys(input || {}),
    },
    {
      level: 'info',
      message: 'sandbox.completed',
      at: new Date().toISOString(),
      run_id: runId,
      spell_id: spellId,
      tenant_id: tenantId,
    },
  ]

  const sbom = {
    spdxVersion: 'SPDX-2.3',
    SPDXID: `SPDXRef-DOCUMENT-${runId}`,
    dataLicense: 'CC0-1.0',
    name: `spell-${spellId}`,
    creationInfo: {
      created: now,
      creators: ['Organization: Spell Sandbox'],
    },
    packages: [
      {
        SPDXID: `SPDXRef-Package-${spellId}`,
        name: `spell-${spellId}`,
        versionInfo: input?.version ?? 'local-dev',
        supplier: 'Organization: Spell Sandbox',
      },
    ],
  }

  await writeFile(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2))
  await writeFile(
    path.join(outputDir, 'logs.ndjson'),
    logs.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
  )
  await writeFile(path.join(outputDir, 'sbom.spdx.json'), JSON.stringify(sbom, null, 2))

  console.log('sandbox-runner: artifact populated at', outputDir)
}

main().catch((err) => {
  console.error('sandbox-runner: fatal error', err)
  process.exit(1)
})
