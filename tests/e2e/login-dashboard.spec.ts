import { test, expect } from '@playwright/test'

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'gestor1@frotamaq.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? '123456'

test.describe('Fluxo principal — Login e Dashboard', () => {
  test('carrega login, autentica e exibe cards do dashboard', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('heading', { name: 'FrotaMaq' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entrar na sua conta' })).toBeVisible()

    await page.getByLabel('E-mail').fill(TEST_EMAIL)
    await page.getByLabel('Senha').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page).toHaveURL('/', { timeout: 30_000 })

    await expect(page.getByText('Veículos ativos')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Em manutenção')).toBeVisible()
    await expect(page.getByText('Parados')).toBeVisible()
    await expect(page.getByText(/Custo total/i)).toBeVisible()
  })
})
