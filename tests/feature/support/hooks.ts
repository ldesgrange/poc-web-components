import fs from 'fs'
import { After, AfterAll, Before, BeforeAll, ITestCaseHookParameter, setDefaultTimeout, setWorldConstructor } from '@cucumber/cucumber'
import slugify from 'slugify'
import v8ToIstanbul from 'v8-to-istanbul'

import { startServer, stopServer } from './server.js'
import { CustomParameters, CustomWorld } from './world.js'

setWorldConstructor(CustomWorld)
setDefaultTimeout(15000)

type CoverageEntry = { url: string; scriptId: string; source?: string; functions: Array<{ functionName: string; isBlockCoverage: boolean; ranges: Array<{ count: number; startOffset: number; endOffset: number; }>; }>; }

const COVERAGE_DIRECTORY = 'coverage/feature'

async function saveCoverage(coverage: CoverageEntry[], scenario: string): Promise<void> {
  fs.mkdirSync(COVERAGE_DIRECTORY, { recursive: true })
  const scenarioSlug = slugify(scenario, { lower: true, strict: true })

  let allCoverages = {}
  for (const entry of coverage) {
    const regExp = /https?:\/\/[^/]+\/(?<file>.*)/
    const file = entry.url.match(regExp)?.groups?.['file']
    if (!file || file.startsWith('@') || file.startsWith('node_modules') || !file.endsWith('.ts') ) continue

    const converter = v8ToIstanbul(`${file}`, 0, { source: entry.source! })
    await converter.load()
    converter.applyCoverage(entry.functions)
    allCoverages = { ...allCoverages, ...(converter.toIstanbul()) }
  }
  fs.appendFileSync(`${COVERAGE_DIRECTORY}/${scenarioSlug}.json`, JSON.stringify(allCoverages))
}

BeforeAll(async function () {
  // Delete the coverage folder before running the tests.
  if (fs.existsSync(COVERAGE_DIRECTORY)) {
    fs.rm(COVERAGE_DIRECTORY, { recursive: true, force: true }, () => {})
  }
  // Start the app once before all scenarios.
  const parameters = this.parameters as unknown as CustomParameters
  parameters.baseUrl = await startServer()
})

AfterAll(async function () {
  // Stop the app after all scenarios.
  await stopServer()
})

Before(async function (this: CustomWorld) {
  // Start the browser before each scenario.
  await this.openBrowser()
  // Grant default permissions.
  await this.page.context().grantPermissions(['storage-access'])
  // Start recording coverage.
  await this.page.coverage.startJSCoverage({ resetOnNavigation: false })
})

After(async function (this: CustomWorld, scenario: ITestCaseHookParameter) {
  // Stop recording coverage.
  const coverage = await this.page.coverage.stopJSCoverage()
  // Save the coverage to a file.
  await saveCoverage(coverage, scenario.pickle.name)
  // Close the browser after each scenario.
  await this.closeBrowser()
})
