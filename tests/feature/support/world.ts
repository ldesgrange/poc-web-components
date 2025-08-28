import { IWorldOptions, World } from '@cucumber/cucumber'
import { Browser, BrowserContext, chromium, Page } from '@playwright/test'

export interface CustomParameters {
  baseUrl: string;
}

export class CustomWorld extends World<CustomParameters> {
  public browser!: Browser
  public context!: BrowserContext
  public page!: Page

  constructor(options: IWorldOptions<CustomParameters>) {
    super(options)
  }

  async openBrowser(): Promise<void> {
    this.browser = await chromium.launch({ headless: true })
    this.context = await this.browser.newContext()
    this.page = await this.context.newPage()
  }

  async goto(url?: string): Promise<void> {
    await this.page.goto(url ?? this.parameters.baseUrl)
  }

  async closeBrowser(): Promise<void> {
    await this.browser?.close()
  }
}
